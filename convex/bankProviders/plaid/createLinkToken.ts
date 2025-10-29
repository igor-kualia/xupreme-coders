import { action } from '../../_generated/server';
import { v } from 'convex/values';
import { Products, CountryCode } from 'plaid';
import { plaidClient, plaidConfig } from './plaidClient';

/**
 * Creates a Plaid Link token that can be used to initialize Plaid Link on the frontend.
 *
 * Environment variables required:
 * - PLAID_CLIENT_ID: Your Plaid client ID
 * - PLAID_SECRET: Your Plaid secret key
 * - PLAID_ENV: The Plaid environment (sandbox, development, or production)
 *
 * @param userId - A unique identifier for the user
 * @returns An object containing the link_token and expiration
 */
export const createLinkToken = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('Creating Plaid link token for user:', args.userId);
    console.log('Plaid config:', {
      clientName: plaidConfig.clientName,
      language: plaidConfig.language,
    });

    try {
      // Create link token
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: args.userId,
        },
        client_name: plaidConfig.clientName,
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: plaidConfig.language,
      });

      console.log('Link token created successfully');
      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error) {
      // Log detailed error information
      console.error('Plaid API error:', error);

      // Handle Plaid API errors with more detail
      if (error && typeof error === 'object') {
        // Plaid errors have response.data with error details
        const plaidError = error as any;
        if (plaidError.response?.data) {
          console.error('Plaid error details:', JSON.stringify(plaidError.response.data, null, 2));
          throw new Error(`Failed to create Plaid link token: ${JSON.stringify(plaidError.response.data)}`);
        }
      }

      if (error instanceof Error) {
        throw new Error(`Failed to create Plaid link token: ${error.message}`);
      }
      throw new Error('Failed to create Plaid link token: Unknown error');
    }
  },
});
