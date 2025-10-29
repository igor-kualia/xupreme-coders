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

      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error) {
      // Handle Plaid API errors
      if (error instanceof Error) {
        throw new Error(`Failed to create Plaid link token: ${error.message}`);
      }
      throw new Error('Failed to create Plaid link token: Unknown error');
    }
  },
});
