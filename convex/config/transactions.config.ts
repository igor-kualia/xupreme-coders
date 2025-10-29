/**
 * Configuration for dummy transaction generation
 */

export interface MerchantConfig {
  name: string;
  category: string;
  amountRange: {
    min: number; // Amount in cents
    max: number; // Amount in cents
  };
  frequency?: number; // Weight for random selection (default: 1.0)
}

export interface TransactionGeneratorConfig {
  daysInPast: number; // How many days back to generate transactions
  transactionsPerDay: number; // Average transactions per day (can be decimal)
  merchants: MerchantConfig[];
}

/**
 * Default configuration for transaction generation
 * - 730 days (2 years) of transaction history
 * - ~1 transaction per day (30 per month)
 */
export const transactionConfig: TransactionGeneratorConfig = {
  daysInPast: 730, // 2 years
  transactionsPerDay: 1.0, // ~30 transactions per month

  merchants: [
    // Groceries & Food Stores
    {
      name: 'Whole Foods Market',
      category: 'Groceries',
      amountRange: { min: 3500, max: 15000 }, // $35-$150
      frequency: 2.0,
    },
    {
      name: 'Trader Joes',
      category: 'Groceries',
      amountRange: { min: 2500, max: 8000 }, // $25-$80
      frequency: 2.0,
    },
    {
      name: 'Safeway',
      category: 'Groceries',
      amountRange: { min: 4000, max: 12000 }, // $40-$120
      frequency: 1.5,
    },

    // Restaurants & Dining
    {
      name: 'Starbucks',
      category: 'Coffee Shops',
      amountRange: { min: 500, max: 1500 }, // $5-$15
      frequency: 3.0,
    },
    {
      name: 'Chipotle Mexican Grill',
      category: 'Restaurants',
      amountRange: { min: 1200, max: 2500 }, // $12-$25
      frequency: 1.5,
    },
    {
      name: 'Panera Bread',
      category: 'Restaurants',
      amountRange: { min: 1000, max: 2000 }, // $10-$20
      frequency: 1.0,
    },
    {
      name: 'The Cheesecake Factory',
      category: 'Restaurants',
      amountRange: { min: 4000, max: 10000 }, // $40-$100
      frequency: 0.5,
    },
    {
      name: 'Olive Garden',
      category: 'Restaurants',
      amountRange: { min: 3500, max: 7500 }, // $35-$75
      frequency: 0.5,
    },

    // Gas & Transportation
    {
      name: 'Shell',
      category: 'Gas',
      amountRange: { min: 4000, max: 7500 }, // $40-$75
      frequency: 2.0,
    },
    {
      name: 'Chevron',
      category: 'Gas',
      amountRange: { min: 4500, max: 8000 }, // $45-$80
      frequency: 1.5,
    },
    {
      name: 'Uber',
      category: 'Transportation',
      amountRange: { min: 1500, max: 4500 }, // $15-$45
      frequency: 1.0,
    },
    {
      name: 'Lyft',
      category: 'Transportation',
      amountRange: { min: 1200, max: 4000 }, // $12-$40
      frequency: 0.8,
    },

    // Shopping & Retail
    {
      name: 'Amazon',
      category: 'Shopping',
      amountRange: { min: 1500, max: 20000 }, // $15-$200
      frequency: 3.0,
    },
    {
      name: 'Target',
      category: 'Shopping',
      amountRange: { min: 2500, max: 15000 }, // $25-$150
      frequency: 1.5,
    },
    {
      name: 'Walmart',
      category: 'Shopping',
      amountRange: { min: 3000, max: 12000 }, // $30-$120
      frequency: 1.0,
    },
    {
      name: 'Apple Store',
      category: 'Electronics',
      amountRange: { min: 5000, max: 150000 }, // $50-$1500
      frequency: 0.3,
    },
    {
      name: 'Best Buy',
      category: 'Electronics',
      amountRange: { min: 7500, max: 100000 }, // $75-$1000
      frequency: 0.4,
    },

    // Utilities & Bills
    {
      name: 'PG&E',
      category: 'Utilities',
      amountRange: { min: 8000, max: 20000 }, // $80-$200
      frequency: 0.5,
    },
    {
      name: 'Comcast',
      category: 'Internet & Cable',
      amountRange: { min: 7000, max: 15000 }, // $70-$150
      frequency: 0.5,
    },
    {
      name: 'AT&T Wireless',
      category: 'Phone',
      amountRange: { min: 6000, max: 12000 }, // $60-$120
      frequency: 0.5,
    },

    // Entertainment & Subscriptions
    {
      name: 'Netflix',
      category: 'Entertainment',
      amountRange: { min: 1599, max: 2299 }, // $15.99-$22.99
      frequency: 0.5,
    },
    {
      name: 'Spotify',
      category: 'Entertainment',
      amountRange: { min: 1099, max: 1699 }, // $10.99-$16.99
      frequency: 0.5,
    },
    {
      name: 'AMC Theatres',
      category: 'Entertainment',
      amountRange: { min: 2500, max: 6000 }, // $25-$60
      frequency: 0.5,
    },
    {
      name: 'LA Fitness',
      category: 'Gym',
      amountRange: { min: 3500, max: 7500 }, // $35-$75
      frequency: 0.5,
    },

    // Healthcare
    {
      name: 'CVS Pharmacy',
      category: 'Pharmacy',
      amountRange: { min: 1500, max: 8000 }, // $15-$80
      frequency: 0.8,
    },
    {
      name: 'Walgreens',
      category: 'Pharmacy',
      amountRange: { min: 1200, max: 7500 }, // $12-$75
      frequency: 0.7,
    },

    // Personal Care
    {
      name: 'Great Clips',
      category: 'Personal Care',
      amountRange: { min: 1800, max: 3500 }, // $18-$35
      frequency: 0.3,
    },

    // Home & Garden
    {
      name: 'Home Depot',
      category: 'Home Improvement',
      amountRange: { min: 3000, max: 25000 }, // $30-$250
      frequency: 0.5,
    },
    {
      name: 'Lowes',
      category: 'Home Improvement',
      amountRange: { min: 3500, max: 20000 }, // $35-$200
      frequency: 0.4,
    },

    // Income (positive amounts)
    {
      name: 'Direct Deposit - Salary',
      category: 'Salary',
      amountRange: { min: 350000, max: 550000 }, // $3500-$5500
      frequency: 1.5, // More frequent (bi-weekly paychecks ~24/year)
    },
    {
      name: 'Direct Deposit - Paycheck',
      category: 'Salary',
      amountRange: { min: 300000, max: 500000 }, // $3000-$5000
      frequency: 1.2,
    },
    {
      name: 'Freelance Income - Client Payment',
      category: 'Freelance',
      amountRange: { min: 50000, max: 300000 }, // $500-$3000
      frequency: 0.8,
    },
    {
      name: 'Upwork',
      category: 'Freelance',
      amountRange: { min: 25000, max: 150000 }, // $250-$1500
      frequency: 0.5,
    },
    {
      name: 'Interest - Savings Account',
      category: 'Investments',
      amountRange: { min: 500, max: 5000 }, // $5-$50
      frequency: 0.3, // Monthly interest
    },
    {
      name: 'Dividend Payment',
      category: 'Investments',
      amountRange: { min: 5000, max: 50000 }, // $50-$500
      frequency: 0.2, // Quarterly dividends
    },
    {
      name: 'Investment Return',
      category: 'Investments',
      amountRange: { min: 10000, max: 100000 }, // $100-$1000
      frequency: 0.2,
    },
    {
      name: 'Annual Bonus',
      category: 'Salary',
      amountRange: { min: 200000, max: 1000000 }, // $2000-$10000
      frequency: 0.05, // Once or twice a year
    },
    {
      name: 'Tax Refund',
      category: 'Other Income',
      amountRange: { min: 100000, max: 300000 }, // $1000-$3000
      frequency: 0.03, // Once a year
    },
    {
      name: 'Reimbursement',
      category: 'Other Income',
      amountRange: { min: 2000, max: 50000 }, // $20-$500
      frequency: 0.3,
    },
    {
      name: 'Cash Back Rewards',
      category: 'Other Income',
      amountRange: { min: 1000, max: 10000 }, // $10-$100
      frequency: 0.4,
    },
    {
      name: 'Gift',
      category: 'Other Income',
      amountRange: { min: 5000, max: 50000 }, // $50-$500
      frequency: 0.1, // Occasional gifts
    },
    {
      name: 'Rental Income',
      category: 'Business Income',
      amountRange: { min: 150000, max: 300000 }, // $1500-$3000
      frequency: 0.4, // Monthly rental income for some users
    },
    {
      name: 'Side Business Revenue',
      category: 'Business Income',
      amountRange: { min: 50000, max: 250000 }, // $500-$2500
      frequency: 0.5,
    },
  ],
};
