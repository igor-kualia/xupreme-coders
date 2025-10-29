import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';

/**
 * Auth guard that protects routes requiring authentication
 * Redirects to login page if user is not authenticated
 */
export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth0 = inject(Auth0Service);
  const router = inject(Router);

  try {
    // Wait for Auth0 to finish loading by using the observable directly
    // This works better with zoneless change detection
    const isAuthenticated = await firstValueFrom(auth0.isAuthenticated$);

    if (!isAuthenticated) {
      return router.createUrlTree(['/login']);
    }

    return true;
  } catch (error) {
    console.error('Auth guard error:', error);
    return router.createUrlTree(['/login']);
  }
};
