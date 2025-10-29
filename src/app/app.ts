import { Component, signal, inject, afterNextRender } from '@angular/core';
import { PlaidService } from './services/plaid.service';

type ConnectionState = 'idle' | 'loading' | 'plaid-open' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly plaidService = inject(PlaidService);

  protected readonly title = signal('xupreme-coders');
  protected readonly connectionState = signal<ConnectionState>('idle');
  protected readonly errorMessage = signal<string>('');
  protected readonly successMessage = signal<string>('');
  protected readonly userId = signal<string>('demo-user-123'); // Hardcoded for now

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
      this.connectionState.set('error');
      this.errorMessage.set('Failed to load Plaid SDK');
    };
    document.head.appendChild(script);
  }

  protected async linkBank(): Promise<void> {
    try {
      this.connectionState.set('loading');
      this.errorMessage.set('');
      this.successMessage.set('');

      const userId = this.userId();

      // Create link token and initialize
      const linkToken = await this.plaidService.createLinkToken(userId);

      this.connectionState.set('plaid-open');

      // Initialize Plaid Link
      this.plaidService.initializePlaidLink(
        linkToken,
        async (publicToken, metadata) => {
          try {
            this.connectionState.set('processing');

            // Exchange token and create accounts
            const result = await this.plaidService.linkNewPlaidItem(publicToken, metadata, userId);

            this.connectionState.set('success');
            this.successMessage.set(
              `Successfully linked ${result.accounts.length} account(s) from ${metadata.institution?.name || 'your bank'}!`
            );

            // Cleanup
            this.plaidService.destroy();

            // Reset after 5 seconds
            setTimeout(() => {
              this.connectionState.set('idle');
              this.successMessage.set('');
            }, 5000);
          } catch (error) {
            this.connectionState.set('error');
            this.errorMessage.set(
              error instanceof Error ? error.message : 'Failed to link bank account'
            );
            this.plaidService.destroy();
          }
        },
        (error, metadata) => {
          console.log('Plaid Link exited:', error, metadata);

          // Only show error if user didn't just close the modal
          if (error) {
            this.connectionState.set('error');
            this.errorMessage.set(error.display_message || error.error_message);
          } else {
            this.connectionState.set('idle');
          }

          this.plaidService.destroy();
        }
      );

      // Open Plaid Link
      this.plaidService.open();
    } catch (error) {
      console.error('Error linking bank:', error);
      this.connectionState.set('error');
      this.errorMessage.set(error instanceof Error ? error.message : 'An error occurred');
    }
  }

  protected retry(): void {
    this.connectionState.set('idle');
    this.errorMessage.set('');
    void this.linkBank();
  }
}
