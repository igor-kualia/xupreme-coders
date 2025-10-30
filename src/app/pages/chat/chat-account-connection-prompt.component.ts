import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { PlaidService } from '../../services/plaid.service';

@Component({
  selector: 'app-chat-account-connection-prompt',
  imports: [],
  template: `
    <div class="my-4 overflow-hidden rounded-lg border border-border bg-card p-6">
      <div class="mb-4 flex items-start gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            ></path>
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="mb-1 text-base font-semibold">Connect Bank Account</h3>
          <p class="text-sm text-muted-foreground">
            {{ reason() }}
          </p>
        </div>
      </div>

      @if (error()) {
        <div
          class="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {{ error() }}
        </div>
      }

      <button
        type="button"
        (click)="connectAccount()"
        [disabled]="loading()"
        class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        @if (loading()) {
          <svg
            class="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Opening Plaid...</span>
        } @else {
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path>
          </svg>
          <span>Connect Account</span>
        }
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatAccountConnectionPromptComponent {
  private readonly plaidService = inject(PlaidService);

  readonly reason = input.required<string>();

  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

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
      this._error.set('Failed to load Plaid SDK. Please refresh the page and try again.');
    };
    document.head.appendChild(script);
  }

  async connectAccount(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      await this.plaidService.initiateConnectionFlow();
      // Plaid modal has opened successfully, reset loading state
      // We can't track the actual connection success from here
      this._loading.set(false);
    } catch (error) {
      console.error('Error connecting account:', error);
      this._error.set(
        error instanceof Error ? error.message : 'Failed to connect account. Please try again.',
      );
      this._loading.set(false);
    }
  }
}
