import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConvexService } from '../../services/convex.service';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { FunctionReturnType } from 'convex/server';
import { HlmSkeleton } from '../../lib/ui/ui-skeleton-helm/src';

type TransactionsResponse = FunctionReturnType<typeof api.transactions.getTransactionsByIds>;
type Transaction = TransactionsResponse[number];

@Component({
  selector: 'app-chat-transaction-table',
  imports: [CommonModule, HlmSkeleton],
  template: `
    <div class="my-4 overflow-hidden rounded-lg border border-border bg-card">
      @if (loading()) {
        <div class="relative max-h-[500px] overflow-x-auto overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 border-b border-border bg-muted">
              <tr>
                <th class="px-4 py-3 text-left font-medium">Date</th>
                <th class="px-4 py-3 text-left font-medium">Merchant</th>
                <th class="px-4 py-3 text-left font-medium">Category</th>
                <th class="px-4 py-3 text-left font-medium">Account</th>
                <th class="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (_ of skeletonArray(); track $index) {
                <tr class="border-b border-border last:border-0">
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-20" /></td>
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-32" /></td>
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-24" /></td>
                  <td class="px-4 py-3"><hlm-skeleton class="h-4 w-28" /></td>
                  <td class="px-4 py-3 text-right"><hlm-skeleton class="ml-auto h-4 w-16" /></td>
                </tr>
              }
            </tbody>
          </table>
          <div
            class="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent"
          ></div>
        </div>
      } @else if (error()) {
        <div class="p-4 text-sm text-destructive">
          {{ error() }}
        </div>
      } @else if (transactions().length === 0) {
        <div class="p-4 text-sm text-muted-foreground">No transactions found</div>
      } @else {
        <div class="relative max-h-[500px] overflow-x-auto overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 border-b border-border bg-muted">
              <tr>
                <th class="px-4 py-3 text-left font-medium">Date</th>
                <th class="px-4 py-3 text-left font-medium">Merchant</th>
                <th class="px-4 py-3 text-left font-medium">Category</th>
                <th class="px-4 py-3 text-left font-medium">Account</th>
                <th class="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (transaction of transactions(); track transaction._id) {
                <tr class="border-b border-border last:border-0 hover:bg-muted/50">
                  <td class="px-4 py-3 text-muted-foreground">
                    {{ formatDate(transaction.date) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      @if (transaction.merchant?.logoUrl) {
                        <img
                          [src]="transaction.merchant?.logoUrl"
                          [alt]="transaction.merchant?.name"
                          class="h-6 w-6 rounded object-contain"
                        />
                      }
                      <span>{{ transaction.merchant?.name || 'Unknown' }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    {{ transaction.category?.name || 'Uncategorized' }}
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    {{ transaction.bankAccount?.name || 'Unknown' }}
                  </td>
                  <td
                    class="px-4 py-3 text-right font-medium"
                    [class.text-green-600]="Number(transaction.amount) >= 0"
                    [class.text-red-600]="Number(transaction.amount) < 0"
                  >
                    {{ formatAmount(transaction.amount) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div
            class="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent"
          ></div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatTransactionTableComponent {
  private readonly convexService = inject(ConvexService);

  readonly transactionIds = input.required<string[]>();

  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _loadedCacheKey: string | null = null;

  readonly transactions = this._transactions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Create an array for skeleton rows based on the number of transaction IDs
  readonly skeletonArray = computed(() => Array(this.transactionIds().length).fill(null));

  constructor() {
    effect(() => {
      const ids = this.transactionIds();
      if (ids.length > 0) {
        // Create a cache key from the sorted IDs to detect changes
        const cacheKey = ids.slice().sort().join(',');

        // Only load if we haven't already loaded these exact IDs
        if (cacheKey !== this._loadedCacheKey) {
          this.loadTransactions(ids, cacheKey);
        }
      }
    });
  }

  private async loadTransactions(ids: string[], cacheKey: string) {
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
        this._error.set('No valid transaction IDs provided');
        this._loading.set(false);
        return;
      }

      const client = this.convexService.getClient();
      const result = await client.query(api.transactions.getTransactionsByIds, {
        transactionIds: validIds as Id<'transaction'>[],
      });

      this._transactions.set(result);
      this._loadedCacheKey = cacheKey;
    } catch (error) {
      console.error('Error loading transactions:', error);
      this._error.set('Failed to load transactions');
    } finally {
      this._loading.set(false);
    }
  }

  formatDate(dateString: string): string {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  formatAmount(amount: bigint | number): string {
    const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
    const dollars = Math.abs(numAmount) / 100;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);

    return numAmount >= 0 ? `+${formatted}` : `-${formatted}`;
  }

  Number(value: bigint | number): number {
    return typeof value === 'bigint' ? Number(value) : value;
  }
}
