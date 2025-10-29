import { Injectable, OnDestroy } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ConvexService implements OnDestroy {
  private readonly client: ConvexClient;
  private querySubscriptions: (() => void)[] = [];

  constructor() {
    const convexUrl = environment.convex.url;
    this.client = new ConvexClient(convexUrl);
  }

  getClient(): ConvexClient {
    return this.client;
  }

  // Execute an action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async action<T>(action: any, args?: Record<string, unknown>): Promise<T> {
    return this.client.action(action, args ?? {}) as Promise<T>;
  }

  // Execute a mutation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async mutation<T>(mutation: any, args?: Record<string, unknown>): Promise<T> {
    return this.client.mutation(mutation, args ?? {}) as Promise<T>;
  }

  ngOnDestroy() {
    // Clean up all query subscriptions
    this.querySubscriptions.forEach((unsubscribe) => unsubscribe());
    this.querySubscriptions = [];
  }
}
