import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionsService } from '../../services/transactions.service';
import { BankAccountsService } from '../../services/bank-accounts.service';
import { HlmSkeleton } from '../../lib/ui/ui-skeleton-helm/src';

@Component({
  selector: 'app-transactions',
  imports: [CommonModule, RouterLink, HlmSkeleton],
  template: `
    <div class="container mx-auto p-6" (scroll)="onScroll($event)">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold">Transactions</h1>
        <p class="text-muted-foreground mt-2">View and manage your transaction history</p>
      </div>

      <!-- Summary Cards -->
      <div class="grid gap-4 md:grid-cols-3 mb-8">
        <div class="rounded-lg border border-border bg-card p-6 shadow">
          <h3 class="text-sm font-medium text-muted-foreground">Total Income</h3>
          <p class="text-2xl font-bold text-green-600">
            {{ formatCurrency(transactionsService.totalIncome()) }}
          </p>
        </div>
        <div class="rounded-lg border border-border bg-card p-6 shadow">
          <h3 class="text-sm font-medium text-muted-foreground">Total Expenses</h3>
          <p class="text-2xl font-bold text-red-600">
            {{ formatCurrency(transactionsService.totalExpenses()) }}
          </p>
        </div>
        <div class="rounded-lg border border-border bg-card p-6 shadow">
          <h3 class="text-sm font-medium text-muted-foreground">Net Amount</h3>
          <p
            class="text-2xl font-bold"
            [class.text-green-600]="transactionsService.netAmount() >= 0"
            [class.text-red-600]="transactionsService.netAmount() < 0"
          >
            {{ formatCurrency(transactionsService.netAmount()) }}
          </p>
        </div>
      </div>

      <!-- Loading State -->
      @if (transactionsService.loading() && !transactionsService.hasLoaded()) {
        <div class="rounded-lg border border-border bg-card p-8 text-center shadow">
          <p class="text-muted-foreground">Loading transactions...</p>
        </div>
      }

      <!-- Error State -->
      @if (transactionsService.error()) {
        <div class="rounded-lg border border-destructive bg-card p-6 shadow">
          <p class="text-destructive">{{ transactionsService.error() }}</p>
          <button
            class="mt-4 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            (click)="transactionsService.refresh()"
          >
            Retry
          </button>
        </div>
      }

      <!-- Generating Transactions State -->
      @if (
        transactionsService.hasLoaded() &&
        !transactionsService.hasTransactions() &&
        !transactionsService.loading() &&
        isGeneratingTransactions()
      ) {
        <div class="rounded-lg border border-border bg-card p-12 text-center shadow">
          <div class="flex justify-center mb-4">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <h3 class="text-lg font-semibold mb-2">Generating Transactions</h3>
          <p class="text-muted-foreground mb-4">
            We're creating transaction history for your newly connected bank accounts. This will
            take just a moment...
          </p>
          <a
            routerLink="/dashboard"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            View Bank Accounts
          </a>
        </div>
      }

      <!-- Empty State -->
      @if (
        transactionsService.hasLoaded() &&
        !transactionsService.hasTransactions() &&
        !transactionsService.loading() &&
        !isGeneratingTransactions()
      ) {
        <div class="rounded-lg border border-border bg-card p-12 text-center shadow">
          <h3 class="text-lg font-semibold mb-2">No transactions yet</h3>
          <p class="text-muted-foreground mb-4">
            Transactions will appear here once your bank accounts are connected and synced.
          </p>
          <a
            routerLink="/dashboard"
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </a>
        </div>
      }

      <!-- Transactions List -->
      @if (transactionsService.hasTransactions()) {
        <div class="rounded-lg border border-border bg-card shadow">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="border-b">
                <tr class="text-left">
                  <th class="p-4 font-medium text-sm">Date</th>
                  <th class="p-4 font-medium text-sm">Merchant</th>
                  <th class="p-4 font-medium text-sm">Category</th>
                  <th class="p-4 font-medium text-sm">Account</th>
                  <th class="p-4 font-medium text-sm text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  transaction of transactionsService.sortedTransactions();
                  track transaction._id
                ) {
                  <tr class="border-b hover:bg-muted/50 transition-colors">
                    <td class="p-4 text-sm">
                      {{ formatDate(transaction.date) }}
                    </td>
                    <td class="p-4">
                      <div class="flex items-center gap-2">
                        <div>
                          <p class="text-sm font-medium">
                            {{ transaction.merchant?.name || 'Unknown' }}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="p-4">
                      @if (transaction.category) {
                        <span
                          class="inline-flex items-center rounded-md border border-input bg-background px-2.5 py-0.5 text-xs font-semibold"
                        >
                          {{ transaction.category.name }}
                        </span>
                      } @else if (
                        transaction.categorizationStatus === 'pending' ||
                        transaction.categorizationStatus === 'categorizing'
                      ) {
                        <hlm-skeleton class="h-5 w-24" />
                      } @else {
                        <span class="text-sm text-muted-foreground">Uncategorized</span>
                      }
                    </td>
                    <td class="p-4">
                      <p class="text-sm">{{ transaction.bankAccount?.name || 'Unknown' }}</p>
                      <p class="text-xs text-muted-foreground">
                        {{ transaction.bankAccount?.accountType }}
                      </p>
                    </td>
                    <td class="p-4 text-right">
                      <span
                        class="text-sm font-medium"
                        [class.text-green-600]="Number(transaction.amount) > 0"
                        [class.text-red-600]="Number(transaction.amount) < 0"
                      >
                        {{ formatAmount(transaction.amount) }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination Info and Load More -->
          <div class="p-4 border-t text-sm text-muted-foreground text-center">
            <p class="mb-2">
              Showing {{ transactionsService.totalTransactions() }} of
              {{ transactionsService.totalTransactionsCount() }} transactions
            </p>

            @if (transactionsService.loadingMore()) {
              <div class="flex justify-center items-center gap-2 py-4">
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span>Loading more transactions...</span>
              </div>
            }

            @if (transactionsService.hasMore() && !transactionsService.loadingMore()) {
              <button
                (click)="loadMore()"
                class="mt-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Load More
              </button>
            }

            @if (!transactionsService.hasMore() && transactionsService.totalTransactions() > 0) {
              <p class="text-xs text-muted-foreground mt-2">
                You've reached the end of your transaction history
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class TransactionsComponent {
  readonly transactionsService = inject(TransactionsService);
  private readonly bankAccountsService = inject(BankAccountsService);

  // Check if any bank account is still generating transactions
  readonly isGeneratingTransactions = computed(() => {
    const accounts = this.bankAccountsService.activeBankAccounts();
    return accounts.some(
      (account) =>
        account.transactionsStatus === 'pending' || account.transactionsStatus === 'generating',
    );
  });

  /**
   * Handle scroll event for infinite scrolling
   */
  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const threshold = 200; // pixels from bottom to trigger load

    if (
      element.scrollHeight - element.scrollTop - element.clientHeight < threshold &&
      !this.transactionsService.loadingMore() &&
      this.transactionsService.hasMore()
    ) {
      this.loadMore();
    }
  }

  /**
   * Load more transactions
   */
  loadMore() {
    this.transactionsService.loadMore();
  }

  formatCurrency(amount: number): string {
    const dollars = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
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

  formatDate(dateString: string): string {
    // Parse date string and create date in local timezone
    // This handles dates without timestamps (e.g., "2024-10-29")
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }
    // Fallback for dates with timestamps
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  Number(value: bigint | number): number {
    return typeof value === 'bigint' ? Number(value) : value;
  }
}
