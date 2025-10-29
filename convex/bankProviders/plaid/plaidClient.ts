'use node';

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Log environment configuration for debugging
const plaidEnv = process.env['PLAID_ENV'] ?? 'sandbox';
console.log('Initializing Plaid client with environment:', plaidEnv);
console.log('PLAID_CLIENT_ID set:', !!process.env['PLAID_CLIENT_ID']);
console.log('PLAID_SECRET set:', !!process.env['PLAID_SECRET']);
console.log('Base path:', PlaidEnvironments[plaidEnv]);

// Initialize Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env['PLAID_CLIENT_ID'],
      'PLAID-SECRET': process.env['PLAID_SECRET'],
    },
  },
});

// Export configured Plaid client
export const plaidClient = new PlaidApi(configuration);

// Export common Plaid configuration
export const plaidConfig = {
  clientName: 'XupremeCoders',
  language: 'en' as const,
};
