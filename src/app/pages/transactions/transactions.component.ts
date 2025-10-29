import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionsService } from '../../services/transactions.service';
import { BankAccountsService } from '../../services/bank-accounts.service';
import { HlmSkeleton } from '../../lib/ui/ui-skeleton-helm/src';

@Component({
  selector: 'app-transactions',
  imports: [CommonModule, RouterLink, HlmSkeleton],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
