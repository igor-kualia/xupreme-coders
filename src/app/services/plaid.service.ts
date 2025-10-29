import { Injectable, inject, signal } from '@angular/core';
import { api } from '../../../convex/_generated/api';
import { ConvexService } from './convex.service';

// Plaid Link types for browser SDK
export interface PlaidLinkOptions {
  token: string;
  onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void;
  onExit?: (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => void;
  onLoad?: () => void;
  onEvent?: (eventName: string, metadata: PlaidLinkOnEventMetadata) => void;
}

export interface PlaidLinkOnSuccessMetadata {
  institution?: {
    name: string;
    institution_id: string;
  };
  accounts: {
    id: string;
    name: string;
    type: string;
    subtype: string;
    mask: string;
  }[];
  link_session_id: string;
}

export interface PlaidLinkOnExitMetadata {
  institution?: {
    name: string;
    institution_id: string;
  };
  status?: string;
  link_session_id: string;
  request_id: string;
}

export interface PlaidLinkOnEventMetadata {
  error_code?: string;
  error_message?: string;
  error_type?: string;
  exit_status?: string;
  institution_id?: string;
  institution_name?: string;
  link_session_id: string;
  timestamp: string;
}

export interface PlaidLinkError {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message?: string;
}

interface PlaidLinkHandler {
  open: () => void;
  exit: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    Plaid: {
      create: (config: PlaidLinkOptions) => PlaidLinkHandler;
    };
  }
}

interface PlaidLinkTokenResponse {
  linkToken: string;
  expiration?: string;
}

interface LinkNewPlaidItemResult {
  success: boolean;
  bankLinkId: string;
  accounts: { id: string; name: string; type: string }[];
}

@Injectable({ providedIn: 'root' })
export class PlaidService {
  private readonly convexService = inject(ConvexService);
  private linkHandler: PlaidLinkHandler | null = null;
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async createLinkToken(userId: string): Promise<string> {
    try {
      this._loading.set(true);
      const result = await this.convexService.action<PlaidLinkTokenResponse>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api as any)['bankProviders/plaid/createLinkToken'].createLinkToken,
        { userId }
      );

      if (!result?.linkToken) {
        throw new Error('No link token received');
      }

      return result.linkToken;
    } catch (error) {
      console.error('Error creating link token:', error);
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  initializePlaidLink(
    linkToken: string,
    onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void,
    onExit?: (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => void
  ): void {
    if (!window.Plaid) {
      throw new Error('Plaid SDK not loaded');
    }

    const config: PlaidLinkOptions = {
      token: linkToken,
      onSuccess,
      onExit: onExit ?? (() => console.log('Plaid Link exited')),
      onLoad: () => console.log('Plaid Link loaded'),
      onEvent: (eventName, metadata) => {
        console.log('Plaid event:', eventName, metadata);
      },
    };

    this.linkHandler = window.Plaid.create(config);
  }

  open(): void {
    if (!this.linkHandler) {
      throw new Error('Plaid Link not initialized');
    }
    this.linkHandler.open();
  }

  exit(): void {
    if (this.linkHandler) {
      this.linkHandler.exit();
    }
  }

  destroy(): void {
    if (this.linkHandler) {
      this.linkHandler.destroy();
      this.linkHandler = null;
    }
  }

  /**
   * Links a new Plaid item after successful authentication
   * @param publicToken The public token from Plaid Link
   * @param metadata The metadata from Plaid Link success callback
   * @param userId The user ID
   * @returns The result of linking the Plaid item
   */
  async linkNewPlaidItem(
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
    userId: string
  ): Promise<LinkNewPlaidItemResult> {
    try {
      this._loading.set(true);

      if (!metadata.institution) {
        throw new Error('Institution data is missing');
      }

      const result = await this.convexService.action<LinkNewPlaidItemResult>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api as any)['bankProviders/plaid/linkNewPlaidItem'].linkNewPlaidItem,
        {
          publicToken,
          institutionId: metadata.institution.institution_id,
          institutionName: metadata.institution.name,
          accounts: metadata.accounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            subtype: account.subtype,
            mask: account.mask,
          })),
          userId,
        }
      );

      if (!result?.success) {
        throw new Error('Failed to link bank account');
      }

      return result;
    } catch (error) {
      console.error('Error linking bank account:', error);

      // Handle ConvexError
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error as { data: unknown };
        if (typeof convexError.data === 'string') {
          throw new Error(convexError.data);
        }
        if (
          convexError.data &&
          typeof convexError.data === 'object' &&
          'message' in convexError.data
        ) {
          const dataWithMessage = convexError.data as { message: string };
          throw new Error(dataWithMessage.message);
        }
      }

      // Handle standard Error objects
      if (error instanceof Error) {
        const regex = /ConvexError: (.+)/;
        const match = regex.exec(error.message);
        if (match) {
          throw new Error(match[1]);
        }
      }

      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Initiates the Plaid Link flow for connecting a new bank account
   * @param userId The user ID to link the bank account to
   */
  async initiateConnectionFlow(userId: string): Promise<void> {
    try {
      // Create link token
      const linkToken = await this.createLinkToken(userId);

      // Initialize Plaid Link
      this.initializePlaidLink(
        linkToken,
        (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
          // On success, link the new Plaid item
          void this.linkNewPlaidItem(publicToken, metadata, userId)
            .then(() => {
              this.destroy();
            })
            .catch((error: unknown) => {
              console.error('Error linking new Plaid item:', error);
              this.destroy();
              throw error;
            });
        },
        (error, metadata) => {
          console.log('Plaid Link exited:', error, metadata);
          this.destroy();
        }
      );

      // Open Plaid Link
      this.open();
    } catch (error: unknown) {
      console.error('Error initiating connection flow:', error);
      throw error;
    }
  }
}
