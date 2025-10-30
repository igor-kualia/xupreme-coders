import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConvexService } from '../../services/convex.service';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { FunctionReturnType } from 'convex/server';
import { HlmSkeleton } from '../../lib/ui/ui-skeleton-helm/src';

type BankAccountsResponse = FunctionReturnType<typeof api.bankAccounts.getBankAccountsByIds>;
type BankAccount = BankAccountsResponse[number];

@Component({
  selector: 'app-chat-bank-account-table',
  imports: [CommonModule, HlmSkeleton],
  template: `
    <div class="my-4 overflow-hidden rounded-lg border border-border bg-card">
      @if (loading()) {
        <div #loadingContainer class="relative max-h-[500px] overflow-x-auto overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 border-b border-border bg-muted">
              <tr>
                <th class="px-4 py-3 text-left font-medium">Institution</th>
                <th class="px-4 py-3 text-left font-medium">Account Name</th>
                <th class="px-4 py-3 text-left font-medium">Type</th>
                <th class="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              @for (_ of skeletonArray(); track $index) {
                <tr class="border-b border-border last:border-0">
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-32" /></td>
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-40" /></td>
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-24" /></td>
                  <td class="px-4 py-3 text-right"><hlm-skeleton class="ml-auto h-4 w-20" /></td>
                </tr>
              }
            </tbody>
          </table>
          @if (isLoadingScrollable()) {
            <div
              class="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent"
            ></div>
          }
        </div>
      } @else if (error()) {
        <div class="p-4 text-sm text-destructive">
          {{ error() }}
        </div>
      } @else if (accounts().length === 0) {
        <div class="p-4 text-sm text-muted-foreground">No bank accounts found</div>
      } @else {
        <div #contentContainer class="relative max-h-[500px] overflow-x-auto overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 border-b border-border bg-muted">
              <tr>
                <th class="px-4 py-3 text-left font-medium">Institution</th>
                <th class="px-4 py-3 text-left font-medium">Account Name</th>
                <th class="px-4 py-3 text-left font-medium">Type</th>
                <th class="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              @for (account of accounts(); track account._id) {
                <tr class="border-b border-border last:border-0 hover:bg-muted/50">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      @if (account.institutionLogoUrl) {
                        <img
                          [src]="account.institutionLogoUrl"
                          [alt]="account.institutionName || 'Bank'"
                          class="h-6 w-6 rounded object-contain"
                        />
                      }
                      <span>{{ account.institutionName || 'Unknown Bank' }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col">
                      <span>{{ account.name }}</span>
                      @if (account.accountNumberMask) {
                        <span class="text-xs text-muted-foreground"
                          >(...{{ account.accountNumberMask }})</span
                        >
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    {{ formatAccountType(account.accountType) }}
                  </td>
                  <td
                    class="px-4 py-3 text-right font-medium"
                    [class.text-green-600]="getBalance(account) >= 0"
                    [class.text-red-600]="getBalance(account) < 0"
                  >
                    {{ formatAmount(account.currentBalance) }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot class="border-t border-border bg-muted/50">
              <tr>
                <td colspan="3" class="px-4 py-3 text-right font-medium">Total Balance:</td>
                <td
                  class="px-4 py-3 text-right font-bold"
                  [class.text-green-600]="totalBalance() >= 0"
                  [class.text-red-600]="totalBalance() < 0"
                >
                  {{ formatAmount(totalBalance()) }}
                </td>
              </tr>
            </tfoot>
          </table>
          @if (isContentScrollable()) {
            <div
              class="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent"
            ></div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatBankAccountTableComponent {
  private readonly convexService = inject(ConvexService);

  readonly accountIds = input.required<string[]>();

  private readonly _accounts = signal<BankAccount[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _loadedCacheKey: string | null = null;

  readonly accounts = this._accounts.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Create an array for skeleton rows based on the number of account IDs
  readonly skeletonArray = computed(() => Array(this.accountIds().length).fill(null));

  // Calculate total balance
  readonly totalBalance = computed(() => {
    return this.accounts().reduce((sum, account) => {
      return sum + (account.currentBalance || 0);
    }, 0);
  });

  // Track whether content is scrollable
  private readonly _isLoadingScrollable = signal<boolean>(false);
  private readonly _isContentScrollable = signal<boolean>(false);

  readonly isLoadingScrollable = this._isLoadingScrollable.asReadonly();
  readonly isContentScrollable = this._isContentScrollable.asReadonly();

  // View children for the scrollable containers
  readonly loadingContainer = viewChild<ElementRef<HTMLDivElement>>('loadingContainer');
  readonly contentContainer = viewChild<ElementRef<HTMLDivElement>>('contentContainer');

  constructor() {
    effect(() => {
      const ids = this.accountIds();
      if (ids.length > 0) {
        // Create a cache key from the sorted IDs to detect changes
        const cacheKey = ids.slice().sort().join(',');

        // Only load if we haven't already loaded these exact IDs
        if (cacheKey !== this._loadedCacheKey) {
          this.loadAccounts(ids, cacheKey);
        }
      }
    });

    // Check scroll state after rendering
    afterNextRender(() => {
      this.checkScrollState();
    });
  }

  private async loadAccounts(ids: string[], cacheKey: string) {
    this._loading.set(true);
    this._error.set(null);

    try {
      // Filter out any invalid IDs (Convex IDs have a specific format)
      // Valid Convex IDs are typically 28-32 characters and alphanumeric
      const validIds = ids.filter((id) => {
        if (!id || typeof id !== 'string') {
          return false;
        }
        // Basic validation: Convex IDs are typically 28-32 chars, alphanumeric
        return /^[a-z0-9]{28,32}$/i.test(id);
      });

      if (validIds.length === 0) {
        this._error.set('No valid bank account IDs provided');
        this._loading.set(false);
        return;
      }

      const client = this.convexService.getClient();
      const result = await client.query(api.bankAccounts.getBankAccountsByIds, {
        accountIds: validIds as Id<'bankAccount'>[],
      });

      this._accounts.set(result);
      this._loadedCacheKey = cacheKey;

      // Check scroll state after data loads and DOM updates
      setTimeout(() => this.checkScrollState(), 0);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
      this._error.set('Failed to load bank accounts');
    } finally {
      this._loading.set(false);
    }
  }

  private checkScrollState(): void {
    // Check loading container
    const loadingEl = this.loadingContainer()?.nativeElement;
    if (loadingEl) {
      this._isLoadingScrollable.set(loadingEl.scrollHeight > loadingEl.clientHeight);
    }

    // Check content container
    const contentEl = this.contentContainer()?.nativeElement;
    if (contentEl) {
      this._isContentScrollable.set(contentEl.scrollHeight > contentEl.clientHeight);
    }
  }

  formatAccountType(accountType: string): string {
    // Convert account type from snake_case to Title Case
    return accountType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatAmount(amount: bigint | number | null | undefined): string {
    if (amount === null || amount === undefined) {
      return '$0.00';
    }

    const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
    const dollars = numAmount / 100;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(dollars));

    return numAmount >= 0 ? formatted : `-${formatted}`;
  }

  getBalance(account: BankAccount): number {
    return account.currentBalance || 0;
  }
}
