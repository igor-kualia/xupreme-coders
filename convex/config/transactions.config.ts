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
      amountRange: { min: -15000, max: -3500 }, // $35-$150
      frequency: 1.0, // ~2-3 times per month
    },
    {
      name: 'Trader Joes',
      category: 'Groceries',
      amountRange: { min: -8000, max: -2500 }, // $25-$80
      frequency: 1.0, // ~2-3 times per month
    },
    {
      name: 'Safeway',
      category: 'Groceries',
      amountRange: { min: -12000, max: -4000 }, // $40-$120
      frequency: 0.8, // ~2 times per month
    },

    // Restaurants & Dining
    {
      name: 'Starbucks',
      category: 'Coffee Shops',
      amountRange: { min: -1500, max: -500 }, // $5-$15
      frequency: 3.5,
    },
    {
      name: 'Chipotle Mexican Grill',
      category: 'Restaurants',
      amountRange: { min: -2500, max: -1200 }, // $12-$25
      frequency: 2.0,
    },
    {
      name: 'Panera Bread',
      category: 'Restaurants',
      amountRange: { min: -2000, max: -1000 }, // $10-$20
      frequency: 1.5,
    },
    {
      name: 'The Cheesecake Factory',
      category: 'Restaurants',
      amountRange: { min: -10000, max: -4000 }, // $40-$100
      frequency: 0.6,
    },
    {
      name: 'Olive Garden',
      category: 'Restaurants',
      amountRange: { min: -7500, max: -3500 }, // $35-$75
      frequency: 0.6,
    },

    // Gas & Transportation
    {
      name: 'Shell',
      category: 'Gas',
      amountRange: { min: -7500, max: -4000 }, // $40-$75
      frequency: 2.5,
    },
    {
      name: 'Chevron',
      category: 'Gas',
      amountRange: { min: -8000, max: -4500 }, // $45-$80
      frequency: 2.0,
    },
    {
      name: 'Uber',
      category: 'Transportation',
      amountRange: { min: -4500, max: -1500 }, // $15-$45
      frequency: 1.0,
    },
    {
      name: 'Lyft',
      category: 'Transportation',
      amountRange: { min: -4000, max: -1200 }, // $12-$40
      frequency: 0.8,
    },

    // Shopping & Retail
    {
      name: 'Amazon',
      category: 'Shopping',
      amountRange: { min: -20000, max: -1500 }, // $15-$200
      frequency: 3.5,
    },
    {
      name: 'Target',
      category: 'Shopping',
      amountRange: { min: -15000, max: -2500 }, // $25-$150
      frequency: 2.0,
    },
    {
      name: 'Walmart',
      category: 'Shopping',
      amountRange: { min: -12000, max: -3000 }, // $30-$120
      frequency: 1.5,
    },
    {
      name: 'Apple Store',
      category: 'Electronics',
      amountRange: { min: -150000, max: -5000 }, // $50-$1500
      frequency: 0.3,
    },
    {
      name: 'Best Buy',
      category: 'Electronics',
      amountRange: { min: -100000, max: -7500 }, // $75-$1000
      frequency: 0.4,
    },

    // Housing & Utilities (Monthly recurring bills - higher frequency to ensure ~1/month)
    {
      name: 'Rent Payment',
      category: 'Rent',
      amountRange: { min: -250000, max: -150000 }, // $1500-$2500
      frequency: 2.5, // Guaranteed monthly rent
    },
    {
      name: 'PG&E - Electricity & Gas',
      category: 'Utilities',
      amountRange: { min: -15000, max: -8000 }, // $80-$150
      frequency: 2.5, // Guaranteed monthly
    },
    {
      name: 'Water Bill',
      category: 'Utilities',
      amountRange: { min: -8000, max: -3000 }, // $30-$80
      frequency: 2.5, // Guaranteed monthly
    },
    {
      name: 'Comcast Internet',
      category: 'Internet',
      amountRange: { min: -10000, max: -6000 }, // $60-$100
      frequency: 2.5, // Guaranteed monthly
    },
    {
      name: 'Cable TV - Comcast',
      category: 'Cable',
      amountRange: { min: -12000, max: -7000 }, // $70-$120
      frequency: 1.5, // Monthly for some users
    },
    {
      name: 'AT&T Wireless',
      category: 'Phone',
      amountRange: { min: -12000, max: -6000 }, // $60-$120
      frequency: 2.5, // Guaranteed monthly
    },
    {
      name: 'Verizon Wireless',
      category: 'Phone',
      amountRange: { min: -11000, max: -6500 }, // $65-$110
      frequency: 0.5, // Alternative phone provider (not everyone)
    },
    {
      name: 'T-Mobile',
      category: 'Phone',
      amountRange: { min: -10000, max: -5000 }, // $50-$100
      frequency: 0.5, // Alternative phone provider (not everyone)
    },
    {
      name: 'Renters Insurance',
      category: 'Insurance',
      amountRange: { min: -4000, max: -1500 }, // $15-$40
      frequency: 2.0, // Monthly for most users
    },
    {
      name: 'Car Insurance',
      category: 'Insurance',
      amountRange: { min: -20000, max: -10000 }, // $100-$200
      frequency: 2.5, // Guaranteed monthly
    },

    // Entertainment & Subscriptions
    {
      name: 'Netflix',
      category: 'Entertainment',
      amountRange: { min: -2299, max: -1599 }, // $15.99-$22.99
      frequency: 0.5,
    },
    {
      name: 'Spotify',
      category: 'Entertainment',
      amountRange: { min: -1699, max: -1099 }, // $10.99-$16.99
      frequency: 0.5,
    },
    {
      name: 'AMC Theatres',
      category: 'Entertainment',
      amountRange: { min: -6000, max: -2500 }, // $25-$60
      frequency: 0.5,
    },
    {
      name: 'LA Fitness',
      category: 'Gym',
      amountRange: { min: -7500, max: -3500 }, // $35-$75
      frequency: 0.5,
    },

    // Healthcare
    {
      name: 'CVS Pharmacy',
      category: 'Pharmacy',
      amountRange: { min: -8000, max: -1500 }, // $15-$80
      frequency: 0.8,
    },
    {
      name: 'Walgreens',
      category: 'Pharmacy',
      amountRange: { min: -7500, max: -1200 }, // $12-$75
      frequency: 0.7,
    },

    // Personal Care
    {
      name: 'Great Clips',
      category: 'Personal Care',
      amountRange: { min: -3500, max: -1800 }, // $18-$35
      frequency: 0.3,
    },

    // Home & Garden
    {
      name: 'Home Depot',
      category: 'Home Improvement',
      amountRange: { min: -25000, max: -3000 }, // $30-$250
      frequency: 0.5,
    },
    {
      name: 'Lowes',
      category: 'Home Improvement',
      amountRange: { min: -20000, max: -3500 }, // $35-$200
      frequency: 0.4,
    },

    // Income (positive amounts)
    {
      name: 'Direct Deposit - Salary',
      category: 'Salary',
      amountRange: { min: 350000, max: 420000 }, // $3500-$4200 (bi-weekly paycheck)
      frequency: 1.0, // Bi-weekly paychecks (~26/year, 52 over 2 years = ~$195k)
    },
    {
      name: 'Freelance Income - Client Payment',
      category: 'Freelance',
      amountRange: { min: 30000, max: 100000 }, // $300-$1000
      frequency: 0.08, // Occasional freelance work
    },
    {
      name: 'Upwork',
      category: 'Freelance',
      amountRange: { min: 15000, max: 60000 }, // $150-$600
      frequency: 0.05, // Occasional side gigs
    },
    {
      name: 'Interest - Savings Account',
      category: 'Investments',
      amountRange: { min: 500, max: 2000 }, // $5-$20
      frequency: 0.08, // Monthly interest
    },
    {
      name: 'Dividend Payment',
      category: 'Investments',
      amountRange: { min: 2000, max: 10000 }, // $20-$100
      frequency: 0.03, // Quarterly dividends
    },
    {
      name: 'Tax Refund',
      category: 'Other Income',
      amountRange: { min: 50000, max: 120000 }, // $500-$1200
      frequency: 0.015, // Once a year
    },
    {
      name: 'Reimbursement',
      category: 'Other Income',
      amountRange: { min: 2000, max: 15000 }, // $20-$150
      frequency: 0.06,
    },
    {
      name: 'Cash Back Rewards',
      category: 'Other Income',
      amountRange: { min: 1000, max: 5000 }, // $10-$50
      frequency: 0.1,
    },
    {
      name: 'Gift',
      category: 'Other Income',
      amountRange: { min: 5000, max: 20000 }, // $50-$200
      frequency: 0.03, // Occasional gifts
    },
  ],
};
