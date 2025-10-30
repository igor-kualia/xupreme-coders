import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';

/**
 * Auth service that wraps Auth0 SDK with a signals-based API
 * Provides authentication state and methods for login/logout
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth0 = inject(Auth0Service);

  // Convert Auth0 observables to signals
  readonly isAuthenticated = toSignal(this.auth0.isAuthenticated$, { initialValue: false });
  readonly isLoading = toSignal(this.auth0.isLoading$, { initialValue: true });
  readonly user = toSignal(this.auth0.user$, { initialValue: null });
  readonly error = toSignal(this.auth0.error$, { initialValue: null });

  // Computed signals for derived state
  readonly userDisplayName = computed(() => {
    const user = this.user();
    return user?.name || user?.email || 'User';
  });

  readonly userId = computed(() => {
    const user = this.user();
    return user?.sub || null;
  });

  constructor() {}

  /**
   * Initiates the Auth0 Universal Login flow
   * @param returnUrl - Optional URL to redirect to after login
   */
  login(returnUrl?: string): void {
    this.auth0.loginWithRedirect({
      appState: { target: returnUrl || '/dashboard' },
    });
  }

  /**
   * Initiates the Auth0 signup flow
   * @param returnUrl - Optional URL to redirect to after signup
   */
  signup(returnUrl?: string): void {
    this.auth0.loginWithRedirect({
      appState: { target: returnUrl || '/dashboard' },
      authorizationParams: {
        screen_hint: 'signup',
      },
    });
  }

  /**
   * Logs out the user and redirects to the home page
   */
  logout(): void {
    this.auth0.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  /**
   * Gets the access token for authenticated API requests
   * @returns Promise with the access token or null if not authenticated
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const token = await firstValueFrom(this.auth0.getAccessTokenSilently());
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Gets the ID token for Convex authentication
   * Convex requires ID tokens, not access tokens
   * @returns Promise with the ID token or null if not authenticated
   */
  async getIdToken(): Promise<string | null> {
    try {
      const token = await firstValueFrom(this.auth0.idTokenClaims$);
      return token?.__raw || null;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  /**
   * Checks if the user has completed authentication
   * Uses observable directly for compatibility with zoneless change detection
   * @returns Promise that resolves to true if authenticated
   */
  async checkAuth(): Promise<boolean> {
    try {
      return await firstValueFrom(this.auth0.isAuthenticated$);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }
}
