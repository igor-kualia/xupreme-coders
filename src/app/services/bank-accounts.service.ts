import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { AuthService } from './auth.service';
import { ConvexService } from './convex.service';

// Infer the return type directly from the Convex query
export type BankAccount = FunctionReturnType<typeof api.bankAccounts.listBankAccounts>[number];

export interface BankAccountFilters {
  includeDeleted?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class BankAccountsService {
  private readonly convexService = inject(ConvexService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals for state management
  private readonly _bankAccounts = signal<BankAccount[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _hasLoaded = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _filters = signal<BankAccountFilters>({});

  // Subscription management
  private bankAccountSubscription?: () => void;

  // Public read-only signals
  readonly bankAccounts = this._bankAccounts.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasLoaded = this._hasLoaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filters = this._filters.asReadonly();

  // Computed values
  readonly sortedBankAccounts = computed(() =>
    [...this._bankAccounts()].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    }),
  );

  readonly totalAccounts = computed(() => this._bankAccounts().length);
  readonly hasAccounts = computed(() => this._bankAccounts().length > 0);

  readonly activeBankAccounts = computed(() => {
    return this._bankAccounts().filter((account) => !account.isDeleted);
  });

  readonly deletedBankAccounts = computed(() => {
    return this._bankAccounts().filter((account) => account.isDeleted);
  });

  constructor() {
    // Start watching bank accounts when authenticated
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.startWatchingBankAccounts();
      } else {
        this.stopWatchingBankAccounts();
        this._bankAccounts.set([]);
        this._hasLoaded.set(false);
      }
    });

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      this.stopWatchingBankAccounts();
    });
  }

  /**
   * Update filters and refresh bank accounts
   */
  updateFilters(filters: Partial<BankAccountFilters>) {
    this._filters.update((current) => ({ ...current, ...filters }));
    this.startWatchingBankAccounts();
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this._filters.set({});
    this.startWatchingBankAccounts();
  }

  /**
   * Start watching bank accounts with real-time updates
   */
  private startWatchingBankAccounts() {
    // Stop existing subscription if any
    this.stopWatchingBankAccounts();

    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const queryArgs = {
        includeDeleted: filters.includeDeleted ?? false,
      };

      // Subscribe to the query
      const watcher = this.convexService.watchQuery<BankAccount[]>(
        api.bankAccounts.listBankAccounts,
        queryArgs,
      );

      this.bankAccountSubscription = watcher.subscribe((bankAccounts) => {
        if (bankAccounts !== undefined) {
          this._bankAccounts.set(bankAccounts);
          this._loading.set(false);
          this._hasLoaded.set(true);
        }
      });
    } catch (error) {
      console.error('Error watching bank accounts:', error);
      this._error.set('Failed to load bank accounts');
      this._loading.set(false);
    }
  }

  /**
   * Stop watching bank accounts
   */
  private stopWatchingBankAccounts() {
    if (this.bankAccountSubscription) {
      this.bankAccountSubscription();
      this.bankAccountSubscription = undefined;
    }
  }

  /**
   * Refresh bank accounts manually
   */
  refresh() {
    this.startWatchingBankAccounts();
  }

  /**
   * Clear error state
   */
  clearError() {
    this._error.set(null);
  }
}
