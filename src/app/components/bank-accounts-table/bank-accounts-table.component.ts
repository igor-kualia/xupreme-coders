import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmTableImports } from '../../lib/ui/ui-table-helm/src';
import { HlmIcon } from '../../lib/ui/ui-icon-helm/src';
import { provideIcons } from '@ng-icons/core';
import { lucideBuilding2, lucidePlus, lucideLoader2 } from '@ng-icons/lucide';
import { NgIcon } from '@ng-icons/core';
import { BankAccountsService } from '../../services/bank-accounts.service';
import { PlaidService } from '../../services/plaid.service';

type ConnectionState = 'idle' | 'loading' | 'plaid-open' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-bank-accounts-table',
  imports: [CommonModule, HlmTableImports, NgIcon, HlmIcon],
  providers: [provideIcons({ lucideBuilding2, lucidePlus, lucideLoader2 })],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold">Bank Accounts</h2>
        <div class="flex items-center gap-2">
          @if (loading()) {
            <span class="text-sm text-muted-foreground">Loading...</span>
          }
          @if (connectionState() === 'idle') {
            <button
              (click)="linkBank()"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ng-icon name="lucidePlus" hlm size="sm" />
              Link Bank Account
            </button>
          }
          @if (connectionState() === 'loading' || connectionState() === 'processing') {
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <ng-icon name="lucideLoader2" hlm size="sm" class="animate-spin" />
              <span>{{ connectionState() === 'loading' ? 'Connecting...' : 'Processing...' }}</span>
            </div>
          }
        </div>
      </div>

      @if (connectionState() === 'success' && successMessage()) {
        <div
          class="rounded-md border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200"
        >
          {{ successMessage() }}
        </div>
      }

      @if (connectionState() === 'error' && errorMessage()) {
        <div class="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {{ errorMessage() }}
        </div>
      }

      @if (error()) {
        <div class="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {{ error() }}
        </div>
      }

      @if (!loading() && !hasAccounts()) {
        <div class="rounded-md border border-dashed p-8 text-center">
          <p class="text-muted-foreground">No bank accounts found.</p>
          <p class="mt-2 text-sm text-muted-foreground">Connect a bank account to get started.</p>
        </div>
      }

      @if (hasAccounts()) {
        <div hlmTableContainer class="rounded-md border">
          <table hlmTable>
            <thead hlmTHead>
              <tr hlmTr>
                <th hlmTh>Institution</th>
                <th hlmTh>Account Name</th>
                <th hlmTh>Type</th>
                <th hlmTh class="text-right">Balance</th>
                <th hlmTh class="text-right">Available</th>
                <th hlmTh>Account</th>
                <th hlmTh>Status</th>
                <th hlmTh>Transactions</th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (account of accounts(); track account._id) {
                <tr hlmTr>
                  <td hlmTd>
                    <div class="flex items-center gap-3">
                      @if (account.institutionLogoUrl) {
                        <img
                          [src]="account.institutionLogoUrl"
                          [alt]="account.institutionName || 'Bank logo'"
                          class="size-8 rounded object-contain"
                        />
                      } @else {
                        <div
                          class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"
                        >
                          <ng-icon name="lucideBuilding2" hlm size="sm" />
                        </div>
                      }
                      <span class="font-medium">
                        {{ account.institutionName || 'Unknown' }}
                      </span>
                    </div>
                  </td>
                  <td hlmTd>
                    <div>
                      <div class="font-medium">{{ account.name }}</div>
                      @if (account.officialName && account.officialName !== account.name) {
                        <div class="text-xs text-muted-foreground">
                          {{ account.officialName }}
                        </div>
                      }
                    </div>
                  </td>
                  <td hlmTd>
                    <span class="capitalize">
                      {{ formatAccountType(account.accountType) }}
                    </span>
                  </td>
                  <td hlmTd class="text-right font-mono">
                    {{ formatCurrency(account.currentBalance) }}
                  </td>
                  <td hlmTd class="text-right font-mono">
                    {{ formatCurrency(account.availableBalance) }}
                  </td>
                  <td hlmTd>
                    @if (account.accountNumberMask) {
                      <span class="font-mono text-sm">••••{{ account.accountNumberMask }}</span>
                    } @else {
                      <span class="text-muted-foreground">—</span>
                    }
                  </td>
                  <td hlmTd>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                      [class]="getStatusClass(account.itemStatus)"
                    >
                      {{ account.itemStatus || 'Unknown' }}
                    </span>
                  </td>
                  <td hlmTd>
                    @if (
                      account.transactionsStatus === 'pending' ||
                      account.transactionsStatus === 'generating'
                    ) {
                      <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <ng-icon name="lucideLoader2" hlm size="sm" class="animate-spin" />
                        <span>
                          {{
                            account.transactionsStatus === 'pending'
                              ? 'Loading...'
                              : 'Generating...'
                          }}
                        </span>
                      </div>
                    } @else if (account.transactionsStatus === 'completed') {
                      <span class="text-sm text-green-600">Ready</span>
                    } @else if (account.transactionsStatus === 'failed') {
                      <span class="text-sm text-red-600">Failed</span>
                    } @else {
                      <span class="text-sm text-muted-foreground">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between text-sm text-muted-foreground">
          <p>Showing {{ accounts().length }} account(s)</p>
          @if (lastSynced()) {
            <p>Last synced: {{ formatDate(lastSynced()!) }}</p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankAccountsTableComponent {
  private readonly bankAccountsService = inject(BankAccountsService);
  private readonly plaidService = inject(PlaidService);

  // Plaid connection state
  protected readonly connectionState = signal<ConnectionState>('idle');
  protected readonly errorMessage = signal<string>('');
  protected readonly successMessage = signal<string>('');

  // Reactive state from service
  protected readonly accounts = this.bankAccountsService.activeBankAccounts;
  protected readonly loading = this.bankAccountsService.loading;
  protected readonly hasAccounts = this.bankAccountsService.hasAccounts;
  protected readonly error = this.bankAccountsService.error;

  constructor() {
    // Load Plaid SDK script after render (requires DOM)
    afterNextRender(() => {
      this.loadPlaidScript();
    });
  }

  private loadPlaidScript(): void {
    // Check if already loaded
    if (document.getElementById('plaid-script')) {
      return;
    }

    // Load Plaid CDN script dynamically
    const script = document.createElement('script');
    script.id = 'plaid-script';
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true;
    script.onload = () => {
      console.log('Plaid SDK loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load Plaid SDK');
      this.connectionState.set('error');
      this.errorMessage.set('Failed to load Plaid SDK');
    };
    document.head.appendChild(script);
  }

  protected async linkBank(): Promise<void> {
    try {
      this.connectionState.set('loading');
      this.errorMessage.set('');
      this.successMessage.set('');

      // Create link token
      const linkToken = await this.plaidService.createLinkToken();

      this.connectionState.set('plaid-open');

      // Initialize Plaid Link
      this.plaidService.initializePlaidLink(
        linkToken,
        async (publicToken, metadata) => {
          try {
            this.connectionState.set('processing');

            // Exchange token and create accounts
            const result = await this.plaidService.linkNewPlaidItem(publicToken, metadata);

            this.connectionState.set('success');
            this.successMessage.set(
              `Successfully linked ${result.accounts.length} account(s) from ${metadata.institution?.name || 'your bank'}!`,
            );

            // Cleanup
            this.plaidService.destroy();

            // Reset after 5 seconds
            setTimeout(() => {
              this.connectionState.set('idle');
              this.successMessage.set('');
            }, 5000);
          } catch (error) {
            this.connectionState.set('error');
            this.errorMessage.set(
              error instanceof Error ? error.message : 'Failed to link bank account',
            );
            this.plaidService.destroy();
          }
        },
        (error, metadata) => {
          console.log('Plaid Link exited:', error, metadata);

          // Only show error if user didn't just close the modal
          if (error) {
            this.connectionState.set('error');
            this.errorMessage.set(error.display_message || error.error_message);
          } else {
            this.connectionState.set('idle');
          }

          this.plaidService.destroy();
        },
      );

      // Open Plaid Link
      this.plaidService.open();
    } catch (error) {
      console.error('Error linking bank:', error);
      this.connectionState.set('error');
      this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred');
    }
  }

  // Computed last synced time
  protected readonly lastSynced = computed(() => {
    const accounts = this.accounts();
    if (accounts.length === 0) return null;

    const mostRecent = accounts.reduce(
      (latest, account) => {
        if (!account.lastSyncedAt) return latest;
        if (!latest) return account.lastSyncedAt;
        return new Date(account.lastSyncedAt) > new Date(latest) ? account.lastSyncedAt : latest;
      },
      null as string | null,
    );

    return mostRecent;
  });

  /**
   * Format currency from cents to dollars
   */
  protected formatCurrency(cents: number | undefined | null): string {
    if (cents === undefined || cents === null) {
      return '—';
    }
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  }

  /**
   * Format account type for display
   */
  protected formatAccountType(type: string): string {
    return type.replace(/_/g, ' ');
  }

  /**
   * Get status badge class
   */
  protected getStatusClass(status: string | undefined): string {
    switch (status) {
      case 'Healthy':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'Error':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'Pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'Disconnected':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  }

  /**
   * Format date for display
   */
  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}
