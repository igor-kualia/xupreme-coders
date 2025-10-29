import { Component, signal, inject, afterNextRender, ChangeDetectionStrategy } from '@angular/core';
import { PlaidService } from '../../services/plaid.service';
import { AuthService } from '../../services/auth.service';

type ConnectionState = 'idle' | 'loading' | 'plaid-open' | 'processing' | 'success' | 'error';

/**
 * Dashboard component
 * Main application page with bank linking functionality
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly plaidService = inject(PlaidService);
  private readonly authService = inject(AuthService);

  protected readonly title = signal('Dashboard');
  protected readonly connectionState = signal<ConnectionState>('idle');
  protected readonly errorMessage = signal<string>('');
  protected readonly successMessage = signal<string>('');

  // Use authenticated user's ID from Auth0 instead of hardcoded value
  protected readonly userId = this.authService.userId;
  protected readonly user = this.authService.user;
  protected readonly userDisplayName = this.authService.userDisplayName;

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

      // Create link token and initialize (uses authenticated user automatically)
      const linkToken = await this.plaidService.createLinkToken();

      this.connectionState.set('plaid-open');

      // Initialize Plaid Link
      this.plaidService.initializePlaidLink(
        linkToken,
        async (publicToken, metadata) => {
          try {
            this.connectionState.set('processing');

            // Exchange token and create accounts (uses authenticated user automatically)
            const result = await this.plaidService.linkNewPlaidItem(publicToken, metadata);

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
