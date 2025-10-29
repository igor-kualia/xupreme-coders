import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';

/**
 * Callback page component
 * Handles Auth0 redirect after successful authentication
 */
@Component({
  selector: 'app-callback',
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallbackComponent implements OnInit {
  protected readonly auth0 = inject(Auth0Service);
  protected readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    try {
      // Wait for Auth0 to process the callback
      // The Auth0 SDK will handle the token exchange automatically
      // Use observable directly to work with zoneless change detection
      const isAuthenticated = await firstValueFrom(this.auth0.isAuthenticated$);

      if (isAuthenticated) {
        await this.router.navigate(['/dashboard']);
      } else {
        await this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error during callback processing:', error);
      await this.router.navigate(['/login']);
    }
  }
}
