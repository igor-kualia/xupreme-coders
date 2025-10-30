/**
 * Generates dummy transactions for a bank account based on account type
 */

import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { TransactionPattern, transactionConfig } from '../config/transactions.config';
import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

/**
 * Generates a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates dates for bi-weekly Friday transactions
 */
function generateBiweeklyFridayDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];

  // Find the first Friday on or after startDate
  let current = new Date(startDate);
  while (current.getDay() !== 5) {
    current.setDate(current.getDate() + 1);
  }

  // Generate every other Friday
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 14); // Add 2 weeks
  }

  return dates;
}

/**
 * Generates dates for monthly recurring transactions on a specific day
 */
function generateMonthlyDates(startDate: Date, endDate: Date, dayOfMonth: number): Date[] {
  const dates: Date[] = [];

  // Start from the first occurrence of the day in the month range
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), dayOfMonth);

  // If the current date is before startDate, move to next month
  if (current < startDate) {
    current.setMonth(current.getMonth() + 1);
  }

  while (current <= endDate) {
    // Ensure day doesn't exceed the month's max days
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    if (dayOfMonth <= daysInMonth) {
      dates.push(new Date(current));
    }
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}

/**
 * Generates random dates within each month
 */
function generateRandomMonthlyDates(
  startDate: Date,
  endDate: Date,
  minPerMonth: number,
  maxPerMonth: number,
): Date[] {
  const dates: Date[] = [];

  // Iterate through each month in the date range
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (current <= endDate) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const effectiveStart = current < startDate ? startDate : current;
    const effectiveEnd = monthEnd > endDate ? endDate : monthEnd;

    // Generate random number of transactions for this month
    const count = randomInt(minPerMonth, maxPerMonth);

    for (let i = 0; i < count; i++) {
      const randomDate = new Date(
        effectiveStart.getTime() +
          Math.random() * (effectiveEnd.getTime() - effectiveStart.getTime()),
      );
      dates.push(randomDate);
    }

    // Move to next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return dates;
}

/**
 * Generates amount based on pattern configuration
 */
function generateAmount(pattern: TransactionPattern): number {
  if (pattern.amount !== undefined) {
    return pattern.amount; // Fixed amount
  }

  if (pattern.amountRange) {
    return randomInt(pattern.amountRange.min, pattern.amountRange.max);
  }

  throw new Error('Pattern must have either amount or amountRange');
}

/**
 * Generates dates based on pattern frequency
 */
function generateDatesForPattern(
  pattern: TransactionPattern,
  startDate: Date,
  endDate: Date,
): Date[] {
  switch (pattern.frequency) {
    case 'biweekly_friday':
      return generateBiweeklyFridayDates(startDate, endDate);

    case 'monthly':
      if (pattern.dayOfMonth === undefined) {
        throw new Error('Monthly pattern requires dayOfMonth');
      }
      return generateMonthlyDates(startDate, endDate, pattern.dayOfMonth);

    case 'random_monthly':
      if (pattern.minPerMonth === undefined || pattern.maxPerMonth === undefined) {
        throw new Error('random_monthly pattern requires minPerMonth and maxPerMonth');
      }
      return generateRandomMonthlyDates(
        startDate,
        endDate,
        pattern.minPerMonth,
        pattern.maxPerMonth,
      );

    default:
      throw new Error(`Unknown frequency: ${pattern.frequency}`);
  }
}

/**
 * Finds or creates a global merchant by name
 */
async function findOrCreateGlobalMerchant(
  ctx: { db: any },
  merchantName: string,
): Promise<Id<'globalMerchant'>> {
  const now = new Date().toISOString();

  // Try to find existing global merchant
  const existing = await ctx.db
    .query('globalMerchant')
    .withIndex('by_name', (q: any) => q.eq('name', merchantName))
    .first();

  if (existing) {
    return existing._id;
  }

  // Create new global merchant
  const merchantId = await ctx.db.insert('globalMerchant', {
    name: merchantName,
    isVerified: true,
    updatedAt: now,
  });

  return merchantId;
}

/**
 * Finds or creates a user merchant linked to a global merchant
 */
async function findOrCreateUserMerchant(
  ctx: { db: any },
  userId: string,
  globalMerchantId: Id<'globalMerchant'>,
): Promise<Id<'merchant'>> {
  const now = new Date().toISOString();

  // Try to find existing user merchant
  const existing = await ctx.db
    .query('merchant')
    .withIndex('by_userId_globalMerchantId', (q: any) =>
      q.eq('userId', userId).eq('globalMerchantId', globalMerchantId),
    )
    .first();

  if (existing) {
    return existing._id;
  }

  // Create new user merchant
  const merchantId = await ctx.db.insert('merchant', {
    globalMerchantId,
    userId,
    isDeleted: false,
    updatedAt: now,
  });

  return merchantId;
}

/**
 * Generates dummy transactions for a bank account based on its account type
 */
export const generateDummyTransactions = internalMutation({
  args: {
    bankAccountId: v.id('bankAccount'),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { bankAccountId, userId } = args;
    const now = new Date().toISOString();

    console.log(
      `Starting transaction generation for bankAccount: ${bankAccountId}, user: ${userId}`,
    );

    try {
      // Get bank account to determine account type
      const bankAccount = await ctx.db.get(bankAccountId);
      if (!bankAccount) {
        throw new Error(`Bank account ${bankAccountId} not found`);
      }

      // Update bank account status to 'generating'
      await ctx.db.patch(bankAccountId, {
        transactionsStatus: 'generating',
      });

      // Check if transactions already exist for this account
      const existingTransactions = await ctx.db
        .query('transaction')
        .withIndex('by_bankAccountId', (q) => q.eq('bankAccountId', bankAccountId))
        .first();

      if (existingTransactions) {
        console.log('Transactions already exist for this account, skipping...');
        // Update status to completed since transactions exist
        await ctx.db.patch(bankAccountId, {
          transactionsStatus: 'completed',
        });
        return { message: 'Transactions already exist', count: 0 };
      }

      // Get account type and corresponding configuration
      const accountType = bankAccount.accountType;
      console.log(`Account type: ${accountType}`);

      const accountConfig =
        transactionConfig.accountTypes[accountType as keyof typeof transactionConfig.accountTypes];
      if (!accountConfig) {
        throw new Error(`No configuration found for account type: ${accountType}`);
      }

      // Calculate date range
      const endDate = new Date(); // Today
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - transactionConfig.daysInPast);

      console.log(
        `Generating transactions from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      );

      // Generate transactions based on patterns
      const transactionsToInsert = [];
      let totalCount = 0;

      for (const pattern of accountConfig.patterns) {
        console.log(`Processing pattern: ${pattern.merchant} (${pattern.frequency})`);

        // Generate dates for this pattern
        const dates = generateDatesForPattern(pattern, startDate, endDate);
        console.log(`  Generated ${dates.length} transaction dates`);

        // Find or create merchant
        const globalMerchantId = await findOrCreateGlobalMerchant(ctx, pattern.merchant);
        const merchantId = await findOrCreateUserMerchant(ctx, userId, globalMerchantId);

        // Create transaction for each date
        for (const date of dates) {
          const amount = generateAmount(pattern);

          transactionsToInsert.push({
            amount: BigInt(amount),
            bankAccountId,
            categoryId: undefined, // Will be set by LLM categorization
            categorizationStatus: 'pending' as const,
            date: date.toISOString().split('T')[0], // YYYY-MM-DD
            merchantId,
            userId,
            type: 'regular' as const,
            source: 'automatic_import' as const,
            isDeleted: false,
            updatedAt: now,
            createdAt: now,
          });

          totalCount++;

          // Insert in batches of 50 to avoid timeout
          if (transactionsToInsert.length >= 50) {
            for (const transaction of transactionsToInsert) {
              await ctx.db.insert('transaction', transaction);
            }
            console.log(`Inserted batch of ${transactionsToInsert.length} transactions`);
            transactionsToInsert.length = 0;
          }
        }
      }

      // Insert remaining transactions
      if (transactionsToInsert.length > 0) {
        for (const transaction of transactionsToInsert) {
          await ctx.db.insert('transaction', transaction);
        }
        console.log(`Inserted final batch of ${transactionsToInsert.length} transactions`);
      }

      console.log(`Successfully generated ${totalCount} transactions`);

      // Update bank account status to 'completed'
      await ctx.db.patch(bankAccountId, {
        transactionsStatus: 'completed',
      });

      // Check if user already has categories before seeding
      const existingCategoryGroups = await ctx.db
        .query('categoryGroup')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first();

      // Only seed categories if they don't exist
      if (!existingCategoryGroups) {
        console.log('Seeding user categories...');
        await ctx.scheduler.runAfter(0, internal.internal.seedUserCategories.seedUserCategories, {
          userId,
        });
      } else {
        console.log('User already has categories, skipping seed...');
      }

      // Trigger LLM categorization for the generated transactions
      console.log('Scheduling LLM categorization...');
      await ctx.scheduler.runAfter(
        2000, // 2 second delay to ensure categories are seeded first
        internal.categorization.categorizeTransactions.categorizeTransactions,
        {
          userId,
          bankAccountId,
        },
      );

      return {
        message: 'Successfully generated transactions',
        count: totalCount,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    } catch (error) {
      console.error('Error generating transactions:', error);

      // Update bank account status to 'failed'
      await ctx.db.patch(bankAccountId, {
        transactionsStatus: 'failed',
      });

      throw error;
    }
  },
});
