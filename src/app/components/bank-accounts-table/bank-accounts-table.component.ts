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
  templateUrl: './bank-accounts-table.component.html',
  styleUrl: './bank-accounts-table.component.css',
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
