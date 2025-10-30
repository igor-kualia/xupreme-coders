/**
 * Configuration for dummy transaction generation with account-type-specific patterns
 */

export interface TransactionPattern {
  merchant: string;
  category: string;
  amount?: number; // Exact amount in cents (for fixed transactions)
  amountRange?: { min: number; max: number }; // For variable amounts
  frequency: 'biweekly_friday' | 'monthly' | 'random_monthly';
  dayOfMonth?: number; // For monthly transactions (1-28)
  minPerMonth?: number; // For random_monthly (min occurrences per month)
  maxPerMonth?: number; // For random_monthly (max occurrences per month)
}

export interface AccountTypeConfig {
  patterns: TransactionPattern[];
}

export interface TransactionGeneratorConfig {
  daysInPast: number; // How many days back to generate transactions
  accountTypes: {
    checking: AccountTypeConfig;
    savings: AccountTypeConfig;
    credit_card: AccountTypeConfig;
  };
}

/**
 * Transaction configuration for each account type
 * Amounts are in cents (e.g., $3000 = 300000 cents)
 */
export const transactionConfig: TransactionGeneratorConfig = {
  daysInPast: 365, // 1 year

  accountTypes: {
    // CHECKING ACCOUNT: Income, bills, transfers, payments
    checking: {
      patterns: [
        // Income: Salary every other Friday
        {
          merchant: 'Direct Deposit - Salary',
          category: 'Salary',
          amount: 300000, // $3000
          frequency: 'biweekly_friday',
        },

        // Housing & Utilities
        {
          merchant: 'Rent Payment',
          category: 'Rent',
          amount: -200000, // $2000
          frequency: 'monthly',
          dayOfMonth: 1,
        },
        {
          merchant: 'Water Bill',
          category: 'Utilities',
          amount: -7500, // $75
          frequency: 'monthly',
          dayOfMonth: 5,
        },
        {
          merchant: 'PG&E - Electricity',
          category: 'Utilities',
          amount: -15000, // $150
          frequency: 'monthly',
          dayOfMonth: 10,
        },

        // Car Payment
        {
          merchant: 'Auto Loan Payment',
          category: 'Auto & Transport',
          amount: -50000, // $500
          frequency: 'monthly',
          dayOfMonth: 15,
        },

        // Transfers & Payments
        {
          merchant: 'Transfer to Savings',
          category: 'Transfer',
          amount: -50000, // -$500
          frequency: 'monthly',
          dayOfMonth: 20,
        },
        {
          merchant: 'Credit Card Payment',
          category: 'Credit Card Payment',
          amount: -50000, // -$500
          frequency: 'monthly',
          dayOfMonth: 25,
        },
      ],
    },

    // SAVINGS ACCOUNT: Transfers in
    savings: {
      patterns: [
        {
          merchant: 'Transfer from Checking',
          category: 'Transfer',
          amount: 50000, // +$500
          frequency: 'monthly',
          dayOfMonth: 20,
        },
      ],
    },

    // CREDIT CARD: Subscriptions and dining
    credit_card: {
      patterns: [
        // Streaming Services
        {
          merchant: 'Netflix',
          category: 'Entertainment',
          amount: -2000, // $20
          frequency: 'monthly',
          dayOfMonth: 5,
        },
        {
          merchant: 'Hulu',
          category: 'Entertainment',
          amount: -1800, // $18
          frequency: 'monthly',
          dayOfMonth: 8,
        },
        {
          merchant: 'Disney Plus',
          category: 'Entertainment',
          amount: -1400, // $14
          frequency: 'monthly',
          dayOfMonth: 12,
        },

        // Utilities
        {
          merchant: 'Comcast Internet',
          category: 'Internet',
          amount: -10000, // $100
          frequency: 'monthly',
          dayOfMonth: 15,
        },
        {
          merchant: 'iCloud Storage',
          category: 'Software',
          amount: -1000, // $10
          frequency: 'monthly',
          dayOfMonth: 10,
        },

        // Dining Out - Random throughout the month
        {
          merchant: 'Taco Bell',
          category: 'Restaurants',
          amountRange: { min: -1500, max: -800 }, // $8-$15
          frequency: 'random_monthly',
          minPerMonth: 3,
          maxPerMonth: 7,
        },
        {
          merchant: 'McDonalds',
          category: 'Restaurants',
          amountRange: { min: -1500, max: -800 }, // $8-$15
          frequency: 'random_monthly',
          minPerMonth: 3,
          maxPerMonth: 7,
        },
        {
          merchant: 'Starbucks',
          category: 'Coffee Shops',
          amountRange: { min: -1200, max: -500 }, // $5-$12
          frequency: 'random_monthly',
          minPerMonth: 4,
          maxPerMonth: 8,
        },
        {
          merchant: 'Dunkin',
          category: 'Coffee Shops',
          amountRange: { min: -1000, max: -400 }, // $4-$10
          frequency: 'random_monthly',
          minPerMonth: 4,
          maxPerMonth: 8,
        },
      ],
    },
  },
};
