import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { AuthService } from './auth.service';
import { ConvexService } from './convex.service';

// Infer the return type from the paginated response
type PaginatedResponse = FunctionReturnType<typeof api.transactions.listTransactions>;
export type Transaction = PaginatedResponse['transactions'][number];

// Infer the return type from the transaction summary
type TransactionSummary = FunctionReturnType<typeof api.transactions.getTransactionSummary>;

export interface TransactionFilters {
  bankAccountId?: Id<'bankAccount'>;
  categoryId?: Id<'category'>;
  merchantId?: Id<'merchant'>;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TransactionsService {
  private readonly convexService = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals for state management
  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _loadingMore = signal<boolean>(false);
  private readonly _hasLoaded = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _filters = signal<TransactionFilters>({ limit: 50 });
  private readonly _currentLimit = signal<number>(50);
  private readonly PAGE_SIZE = 50;

  // Transaction summary signals (from backend, all transactions)
  private readonly _summary = signal<TransactionSummary | null>(null);

  // Subscription management
  private transactionSubscription?: () => void;
  private summarySubscription?: () => void;

  // Public read-only signals
  readonly transactions = this._transactions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly hasLoaded = this._hasLoaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filters = this._filters.asReadonly();

  // Computed to check if there are more transactions to load
  readonly hasMore = computed(() => {
    const currentCount = this._transactions().length;
    const limit = this._currentLimit();
    // If we have exactly the limit, there might be more
    return currentCount >= limit;
  });

  // Computed values - backend already sorts, so just return transactions
  readonly sortedTransactions = computed(() => this._transactions());

  readonly totalTransactions = computed(() => this._transactions().length);
  readonly hasTransactions = computed(() => this._transactions().length > 0);

  // Transaction summary stats (from backend - includes ALL transactions)
  readonly totalIncome = computed(() => this._summary()?.totalIncome ?? 0);
  readonly totalExpenses = computed(() => this._summary()?.totalExpenses ?? 0);
  readonly netAmount = computed(() => this._summary()?.netAmount ?? 0);
  readonly totalTransactionsCount = computed(() => this._summary()?.totalTransactions ?? 0);

  readonly transactionsByCategory = computed(() => {
    const byCategory: Record<string, Transaction[]> = {};
    for (const transaction of this._transactions()) {
      const categoryName = transaction.category?.name || 'Uncategorized';
      if (!byCategory[categoryName]) {
        byCategory[categoryName] = [];
      }
      byCategory[categoryName].push(transaction);
    }
    return byCategory;
  });

  readonly transactionsByMerchant = computed(() => {
    const byMerchant: Record<string, Transaction[]> = {};
    for (const transaction of this._transactions()) {
      const merchantName = transaction.merchant?.name || 'Unknown';
      if (!byMerchant[merchantName]) {
        byMerchant[merchantName] = [];
      }
      byMerchant[merchantName].push(transaction);
    }
    return byMerchant;
  });

  constructor() {
    // Start watching transactions when authenticated
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.startWatchingTransactions();
        this.startWatchingSummary();
      } else {
        this.stopWatchingTransactions();
        this.stopWatchingSummary();
        this._transactions.set([]);
        this._summary.set(null);
        this._hasLoaded.set(false);
      }
    });

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      this.stopWatchingTransactions();
      this.stopWatchingSummary();
    });
  }

  /**
   * Update filters and refresh transactions
   */
  updateFilters(filters: Partial<TransactionFilters>) {
    this._filters.update((current) => ({ ...current, ...filters }));
    this._currentLimit.set(this.PAGE_SIZE); // Reset limit when filters change
    this.startWatchingTransactions();
    this.startWatchingSummary(); // Also refresh summary with new filters
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this._filters.set({ limit: 50 });
    this._currentLimit.set(this.PAGE_SIZE);
    this.startWatchingTransactions();
  }

  /**
   * Start watching transactions with real-time updates
   */
  private startWatchingTransactions() {
    // Stop existing subscription if any
    this.stopWatchingTransactions();

    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const limit = this._currentLimit();

      const queryArgs: {
        limit?: number;
        bankAccountId?: Id<'bankAccount'>;
        categoryId?: Id<'category'>;
        merchantId?: Id<'merchant'>;
        startDate?: string;
        endDate?: string;
      } = {
        limit,
      };

      if (filters.bankAccountId) {
        queryArgs.bankAccountId = filters.bankAccountId;
      }
      if (filters.categoryId) {
        queryArgs.categoryId = filters.categoryId;
      }
      if (filters.merchantId) {
        queryArgs.merchantId = filters.merchantId;
      }
      if (filters.startDate) {
        queryArgs.startDate = filters.startDate;
      }
      if (filters.endDate) {
        queryArgs.endDate = filters.endDate;
      }

      // Subscribe to the query with real-time updates
      const watcher = this.convexService.watchQuery<PaginatedResponse>(
        api.transactions.listTransactions,
        queryArgs,
      );

      this.transactionSubscription = watcher.subscribe((result) => {
        if (result !== undefined) {
          this._transactions.set(result.transactions);
          this._loading.set(false);
          this._loadingMore.set(false);
          this._hasLoaded.set(true);
        }
      });
    } catch (error) {
      console.error('Error watching transactions:', error);
      this._error.set('Failed to load transactions');
      this._loading.set(false);
      this._loadingMore.set(false);
    }
  }

  /**
   * Load more transactions (for infinite scroll)
   */
  loadMore() {
    if (this._loadingMore() || this._loading() || !this.hasMore()) {
      return;
    }

    this._loadingMore.set(true);
    this._error.set(null);

    // Increase the limit to load more transactions
    const newLimit = this._currentLimit() + this.PAGE_SIZE;
    this._currentLimit.set(newLimit);

    // Restart the subscription with the new limit
    this.startWatchingTransactions();
  }

  /**
   * Stop watching transactions
   */
  private stopWatchingTransactions() {
    if (this.transactionSubscription) {
      this.transactionSubscription();
      this.transactionSubscription = undefined;
    }
  }

  /**
   * Start watching transaction summary with real-time updates
   * This fetches aggregated stats from ALL transactions in the database
   */
  private startWatchingSummary() {
    // Stop existing subscription if any
    this.stopWatchingSummary();

    try {
      const filters = this._filters();

      const queryArgs: {
        startDate?: string;
        endDate?: string;
      } = {};

      if (filters.startDate) {
        queryArgs.startDate = filters.startDate;
      }
      if (filters.endDate) {
        queryArgs.endDate = filters.endDate;
      }

      // Subscribe to the summary query with real-time updates
      const watcher = this.convexService.watchQuery<TransactionSummary>(
        api.transactions.getTransactionSummary,
        queryArgs,
      );

      this.summarySubscription = watcher.subscribe((result) => {
        if (result !== undefined) {
          this._summary.set(result);
        }
      });
    } catch (error) {
      console.error('Error watching transaction summary:', error);
    }
  }

  /**
   * Stop watching transaction summary
   */
  private stopWatchingSummary() {
    if (this.summarySubscription) {
      this.summarySubscription();
      this.summarySubscription = undefined;
    }
  }

  /**
   * Refresh transactions manually
   */
  refresh() {
    this.startWatchingTransactions();
  }

  /**
   * Clear error state
   */
  clearError() {
    this._error.set(null);
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: bigint | number): string {
    const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
    const dollars = Math.abs(numAmount) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  }

  /**
   * Get color class based on amount
   */
  getAmountColorClass(amount: bigint | number): string {
    const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
    return numAmount >= 0 ? 'text-green-600' : 'text-red-600';
  }
}
