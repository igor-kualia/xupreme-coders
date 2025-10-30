import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ConvexService } from '../../services/convex.service';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';

type TransactionsResponse = FunctionReturnType<typeof api.transactions.getTransactionsByIds>;

@Component({
  selector: 'app-chat-transaction-edit-preview',
  imports: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="my-4 rounded-lg border border-primary/20 bg-card p-4">
      <h3 class="mb-3 text-sm font-semibold text-foreground">Proposed Transaction Updates</h3>

      @if (transactions() && transactions()!.length > 0) {
        <div class="mb-4 max-h-[300px] overflow-y-auto rounded-lg border">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-muted">
              <tr class="border-b">
                <th class="p-2 text-left font-medium">Date</th>
                <th class="p-2 text-left font-medium">Merchant</th>
                <th class="p-2 text-right font-medium">Amount</th>
                <th class="p-2 text-left font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              @for (transaction of transactions(); track transaction._id) {
                <tr class="border-b last:border-b-0">
                  <td class="p-2">{{ transaction.date | date: 'MMM d, y' }}</td>
                  <td class="p-2">{{ transaction.merchant?.name || 'Unknown' }}</td>
                  <td
                    class="p-2 text-right"
                    [class.text-destructive]="Number(transaction.amount) < 0"
                    [class.text-green-600]="Number(transaction.amount) > 0"
                  >
                    {{ Number(transaction.amount) / 100 | currency }}
                  </td>
                  <td class="p-2">{{ transaction.category?.name || 'Uncategorized' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <h4 class="mb-2 text-sm font-semibold">Changes to apply:</h4>
        <ul class="space-y-1 text-sm">
          @if (updates().categoryId) {
            <li>
              Category → <strong>{{ categoryName() || 'New Category' }}</strong>
            </li>
          }
          @if (updates().date) {
            <li>
              Date → <strong>{{ updates().date | date: 'MMM d, y' }}</strong>
            </li>
          }
          @if (updates().amount !== undefined) {
            <li>
              Amount →
              <strong
                [class.text-destructive]="updates().amount! < 0"
                [class.text-green-600]="updates().amount! > 0"
                >{{ updates().amount! / 100 | currency }}</strong
              >
            </li>
          }
        </ul>
      </div>

      <p class="mt-3 text-xs text-muted-foreground">
        {{ transactionIds().length }} transaction{{ transactionIds().length === 1 ? '' : 's' }}
        will be updated
      </p>
    </div>
  `,
})
export class ChatTransactionEditPreviewComponent {
  private readonly convex = inject(ConvexService);

  // Inputs
  readonly transactionIds = input.required<string[]>();
  readonly updates = input.required<{
    categoryId?: string;
    categoryName?: string;
    date?: string;
    amount?: number;
  }>();

  // Internal state
  private readonly _transactions = signal<TransactionsResponse>([]);
  readonly transactions = this._transactions.asReadonly();

  // Get category name from the updates input
  protected readonly categoryName = computed(() => {
    return this.updates().categoryName || 'New Category';
  });

  // Make Number available in template
  protected readonly Number = Number;

  constructor() {
    effect(() => {
      const ids = this.transactionIds();
      if (ids.length > 0) {
        this.loadTransactions(ids);
      }
    });
  }

  private async loadTransactions(ids: string[]) {
    try {
      const validIds = ids.filter((id) => {
        if (!id || typeof id !== 'string') {
          return false;
        }
        return /^[a-z0-9]{28,32}$/i.test(id);
      });

      if (validIds.length === 0) {
        return;
      }

      const client = this.convex.getClient();
      const result = await client.query(api.transactions.getTransactionsByIds, {
        transactionIds: validIds as Id<'transaction'>[],
      });

      this._transactions.set(result);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }
}
