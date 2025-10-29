import { Injectable, OnDestroy, inject, signal, Signal } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Convex service for managing Convex client and operations
 * Automatically attaches Auth0 JWT tokens to authenticated requests
 */
@Injectable({
  providedIn: 'root',
})
export class ConvexService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly client: ConvexClient;
  private querySubscriptions: (() => void)[] = [];
  private authInitialized = false;

  constructor() {
    const convexUrl = environment.convex.url;
    this.client = new ConvexClient(convexUrl);

    // Set up auth token provider
    this.setupAuth();
  }

  private async setupAuth(): Promise<void> {
    if (this.authInitialized) {
      return;
    }

    // Wait for Auth0 to finish loading
    while (this.authService.isLoading()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Set up authentication with Convex
    // IMPORTANT: Convex requires ID tokens, not access tokens!
    // Provide a function that fetches the current ID token
    this.client.setAuth(async () => {
      const isAuthenticated = this.authService.isAuthenticated();
      if (!isAuthenticated) {
        return null;
      }

      try {
        // Get ID token instead of access token for Convex
        const token = await this.authService.getIdToken();
        return token || null;
      } catch (error) {
        console.error('Error fetching ID token for Convex:', error);
        return null;
      }
    });

    this.authInitialized = true;
  }

  getClient(): ConvexClient {
    return this.client;
  }

  /**
   * Ensures auth is set up before executing operations
   */
  private async ensureAuth(): Promise<void> {
    if (!this.authInitialized) {
      await this.setupAuth();
    }
  }

  // Execute an action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async action<T>(action: any, args?: Record<string, unknown>): Promise<T> {
    await this.ensureAuth();
    return this.client.action(action, args ?? {}) as Promise<T>;
  }

  // Execute a mutation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async mutation<T>(mutation: any, args?: Record<string, unknown>): Promise<T> {
    await this.ensureAuth();
    return this.client.mutation(mutation, args ?? {}) as Promise<T>;
  }

  /**
   * Subscribe to a query with manual subscription management
   * @param query The Convex query function
   * @param args Arguments to pass to the query
   * @returns An object with a subscribe method
   */
  watchQuery<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
    args?: Record<string, unknown>,
  ): { subscribe: (callback: (value: T | undefined) => void) => () => void } {
    const subscribe = (callback: (value: T | undefined) => void) => {
      const unsubscribe = this.client.onUpdate(
        query,
        args ?? {},
        (value: T) => {
          callback(value);
        },
        (error) => {
          console.error('Query error:', error);
          callback(undefined);
        },
      ) as () => void;
      return unsubscribe;
    };

    return { subscribe };
  }

  /**
   * Subscribe to a query and return a signal that updates reactively
   * @param query The Convex query function
   * @param args Arguments to pass to the query
   * @returns A signal containing the query result
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T>(query: any, args?: Record<string, unknown>): Signal<T | undefined> {
    const resultSignal = signal<T | undefined>(undefined);

    const unsubscribe = this.client.onUpdate(
      query,
      args ?? {},
      (value: T) => {
        resultSignal.set(value);
      },
      (error) => {
        console.error('Query error:', error);
        resultSignal.set(undefined);
      },
    ) as () => void;

    // Track subscription for cleanup
    this.querySubscriptions.push(unsubscribe);

    return resultSignal.asReadonly();
  }

  ngOnDestroy() {
    // Clean up all query subscriptions
    this.querySubscriptions.forEach((unsubscribe) => unsubscribe());
    this.querySubscriptions = [];
  }
}
