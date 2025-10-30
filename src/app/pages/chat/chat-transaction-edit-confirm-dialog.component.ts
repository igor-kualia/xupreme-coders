import { ChangeDetectionStrategy, Component, inject, Signal, signal } from '@angular/core';
import { injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButton } from '../../lib/ui/ui-button-helm/src';
import { HlmDialogFooter, HlmDialogHeader } from '../../lib/ui/ui-dialog-helm/src';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';
import { HlmIcon } from '../../lib/ui/ui-icon-helm/src';
import { ConvexService } from '../../services/convex.service';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { CurrencyPipe, DatePipe } from '@angular/common';
import type { FunctionReturnType } from 'convex/server';

interface TransactionEditData {
  transactionIds: string[];
  updates: {
    categoryId?: string;
    date?: string;
    amount?: number;
  };
}

@Component({
  selector: 'app-chat-transaction-edit-confirm-dialog',
  imports: [HlmButton, NgIcon, HlmIcon, HlmDialogHeader, HlmDialogFooter, CurrencyPipe, DatePipe],
  providers: [provideIcons({ lucideLoaderCircle })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4">
      <hlm-dialog-header>
        <h2 class="text-lg font-semibold">Confirm transaction updates</h2>
      </hlm-dialog-header>

      <div class="py-4">
        <p class="mb-4 text-sm text-muted-foreground">
          You are about to update {{ transactionIds.length }} transaction{{
            transactionIds.length === 1 ? '' : 's'
          }}.
        </p>

        @if (transactions() && transactions()!.length > 0) {
          <div class="mb-4 max-h-[400px] overflow-y-auto rounded-lg border">
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
          <h3 class="mb-2 text-sm font-semibold">Proposed changes:</h3>
          <ul class="space-y-1 text-sm">
            @if (updates.categoryId) {
              <li>Category → <strong>New Category</strong></li>
            }
            @if (updates.date) {
              <li>
                Date → <strong>{{ updates.date | date: 'MMM d, y' }}</strong>
              </li>
            }
            @if (updates.amount !== undefined) {
              <li>
                Amount →
                <strong
                  [class.text-destructive]="updates.amount < 0"
                  [class.text-green-600]="updates.amount > 0"
                  >{{ updates.amount / 100 | currency }}</strong
                >
              </li>
            }
          </ul>
        </div>
      </div>

      @if (error()) {
        <div
          class="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive"
        >
          <p class="text-sm">{{ error() }}</p>
        </div>
      }

      <hlm-dialog-footer class="flex-row justify-end">
        <button hlmBtn size="sm" variant="outline" (click)="cancel()" [disabled]="updating()">
          Cancel
        </button>
        <button
          hlmBtn
          size="sm"
          variant="default"
          (click)="confirmUpdate()"
          [disabled]="updating()"
        >
          @if (updating()) {
            <ng-icon hlm name="lucideLoaderCircle" class="mr-2 h-4 w-4 animate-spin" />
            Updating...
          } @else {
            Confirm
          }
        </button>
      </hlm-dialog-footer>
    </div>
  `,
})
export class ChatTransactionEditConfirmDialogComponent {
  private readonly convex = inject(ConvexService);

  protected readonly dialogContext = injectBrnDialogContext<{
    data: TransactionEditData;
    onClose: (updated?: boolean) => void;
  }>();

  protected readonly updating = signal(false);
  protected readonly error = signal<string | null>(null);

  // Extract data from context
  protected readonly transactionIds = this.dialogContext.data.transactionIds;
  protected readonly updates = this.dialogContext.data.updates;

  // Fetch transaction details
  protected readonly transactions: Signal<
    FunctionReturnType<typeof api.transactions.getTransactionsByIds> | undefined
  > = this.convex.query(api.transactions.getTransactionsByIds, {
    transactionIds: this.transactionIds,
  });

  // Make Number available in template
  protected readonly Number = Number;

  cancel() {
    this.dialogContext.onClose(false);
  }

  async confirmUpdate() {
    if (this.updating()) return;

    this.updating.set(true);
    this.error.set(null);

    try {
      await this.convex.mutation(api.transactions.updateTransactions, {
        transactionIds: this.transactionIds.map((id) => id as Id<'transaction'>),
        updates: {
          categoryId: this.updates.categoryId
            ? (this.updates.categoryId as Id<'category'>)
            : undefined,
          date: this.updates.date,
          amount: this.updates.amount !== undefined ? BigInt(this.updates.amount) : undefined,
        },
      });

      this.dialogContext.onClose(true);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to update transactions');
      this.updating.set(false);
    }
  }
}
