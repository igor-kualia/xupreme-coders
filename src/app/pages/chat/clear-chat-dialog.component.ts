import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButton } from '../../lib/ui/ui-button-helm/src';
import { HlmDialogFooter, HlmDialogHeader } from '../../lib/ui/ui-dialog-helm/src';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';
import { HlmIcon } from '../../lib/ui/ui-icon-helm/src';

@Component({
  selector: 'app-clear-chat-dialog',
  imports: [HlmButton, NgIcon, HlmIcon, HlmDialogHeader, HlmDialogFooter],
  providers: [provideIcons({ lucideLoaderCircle })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4">
      <hlm-dialog-header>
        <h2 class="text-lg font-semibold">Clear conversation?</h2>
      </hlm-dialog-header>

      <div class="py-4">
        <p class="text-sm text-muted-foreground">
          This will permanently delete your conversation history. This action cannot be undone.
        </p>
      </div>

      @if (error()) {
        <div
          class="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive"
        >
          <p class="text-sm">{{ error() }}</p>
        </div>
      }

      <hlm-dialog-footer class="flex-row justify-end">
        <button hlmBtn size="sm" variant="outline" (click)="cancel()" [disabled]="clearing()">
          Cancel
        </button>
        <button
          hlmBtn
          size="sm"
          variant="destructive"
          (click)="confirmClear()"
          [disabled]="clearing()"
        >
          @if (clearing()) {
            <ng-icon hlm name="lucideLoaderCircle" class="mr-2 h-4 w-4 animate-spin" />
            Clearing...
          } @else {
            Clear
          }
        </button>
      </hlm-dialog-footer>
    </div>
  `,
})
export class ClearChatDialogComponent {
  protected readonly dialogContext = injectBrnDialogContext<{
    onConfirm: () => Promise<void>;
    onClose: (cleared?: boolean) => void;
  }>();

  protected readonly clearing = signal(false);
  protected readonly error = signal<string | null>(null);

  cancel() {
    this.dialogContext.onClose(false);
  }

  async confirmClear() {
    if (this.clearing()) return;

    this.clearing.set(true);
    this.error.set(null);

    try {
      await this.dialogContext.onConfirm();
      this.dialogContext.onClose(true);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to clear conversation');
      this.clearing.set(false);
    }
  }
}
