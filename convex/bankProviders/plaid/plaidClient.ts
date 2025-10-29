import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Initialize Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env['PLAID_ENV'] ?? 'sandbox'],
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
