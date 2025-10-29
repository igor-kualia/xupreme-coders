/**
 * Generates dummy transactions for a bank account
 */

import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { MerchantConfig, transactionConfig } from '../config/transactions.config';
import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

/**
 * Generates a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random amount within the merchant's range with some variance
 */
function generateAmount(merchant: MerchantConfig): number {
  const { min, max } = merchant.amountRange;
  const baseAmount = randomInt(min, max);

  // Add some variance (+/- 10%)
  const variance = Math.floor(baseAmount * 0.1);
  const amount = baseAmount + randomInt(-variance, variance);

  // For income categories, make amount positive; for expenses, negative
  if (merchant.category === 'Salary' || merchant.category.includes('Income')) {
    return Math.abs(amount);
  }

  return -Math.abs(amount);
}

/**
 * Selects a random merchant weighted by frequency
 */
function selectWeightedMerchant(merchants: MerchantConfig[]): MerchantConfig {
  const totalWeight = merchants.reduce((sum, m) => sum + (m.frequency || 1.0), 0);
  let random = Math.random() * totalWeight;

  for (const merchant of merchants) {
    const weight = merchant.frequency || 1.0;
    if (random < weight) {
      return merchant;
    }
    random -= weight;
  }

  return merchants[merchants.length - 1];
}

/**
 * Generates a random date between start and end dates
 */
function randomDate(startDate: Date, endDate: Date): Date {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
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
 * Generates dummy transactions for a bank account
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
      // Update bank account status to 'generating'
      const bankAccount = await ctx.db.get(bankAccountId);
      if (bankAccount) {
        await ctx.db.patch(bankAccountId, {
          transactionsStatus: 'generating',
        });
      }

      // Check if transactions already exist for this account
      const existingTransactions = await ctx.db
        .query('transaction')
        .withIndex('by_bankAccountId', (q) => q.eq('bankAccountId', bankAccountId))
        .first();

      if (existingTransactions) {
        console.log('Transactions already exist for this account, skipping...');
        // Update status to completed since transactions exist
        if (bankAccount) {
          await ctx.db.patch(bankAccountId, {
            transactionsStatus: 'completed',
          });
        }
        return { message: 'Transactions already exist', count: 0 };
      }

      // Load configuration
      const config = transactionConfig;
      const { daysInPast, transactionsPerDay, merchants } = config;

      // Calculate date range
      const endDate = new Date(); // Today
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysInPast);

      // Calculate approximate number of transactions
      const totalTransactions = Math.floor(daysInPast * transactionsPerDay);
      console.log(`Generating approximately ${totalTransactions} transactions`);

      // Generate transactions
      const transactionsToInsert = [];

      for (let i = 0; i < totalTransactions; i++) {
        // Select a random merchant (weighted)
        const merchantConfig = selectWeightedMerchant(merchants);

        // Generate amount within merchant's range
        const amount = generateAmount(merchantConfig);

        // Generate random date
        const transactionDate = randomDate(startDate, endDate);

        // Find or create global merchant
        const globalMerchantId = await findOrCreateGlobalMerchant(ctx, merchantConfig.name);

        // Find or create user merchant
        const merchantId = await findOrCreateUserMerchant(ctx, userId, globalMerchantId);

        // Create transaction record (categoryId will be set by LLM categorization)
        transactionsToInsert.push({
          amount: BigInt(amount),
          bankAccountId,
          categoryId: undefined, // Will be set by LLM categorization
          categorizationStatus: 'pending' as const, // Waiting for categorization
          date: transactionDate.toISOString().split('T')[0], // YYYY-MM-DD
          merchantId,
          userId,
          type: 'regular' as const,
          source: 'automatic_import' as const,
          isDeleted: false,
          updatedAt: now,
          createdAt: now,
        });

        // Insert in batches of 50 to avoid timeout
        if (transactionsToInsert.length >= 50) {
          for (const transaction of transactionsToInsert) {
            await ctx.db.insert('transaction', transaction);
          }
          console.log(`Inserted batch of ${transactionsToInsert.length} transactions`);
          transactionsToInsert.length = 0;
        }
      }

      // Insert remaining transactions
      if (transactionsToInsert.length > 0) {
        for (const transaction of transactionsToInsert) {
          await ctx.db.insert('transaction', transaction);
        }
        console.log(`Inserted final batch of ${transactionsToInsert.length} transactions`);
      }

      console.log(`Successfully generated ${totalTransactions} transactions`);

      // Update bank account status to 'completed'
      await ctx.db.patch(bankAccountId, {
        transactionsStatus: 'completed',
      });

      // Seed user categories first (if they don't exist)
      console.log('Seeding user categories...');
      await ctx.scheduler.runAfter(0, internal.internal.seedUserCategories.seedUserCategories, {
        userId,
      });

      // Trigger LLM categorization for the generated transactions (after a short delay to ensure categories are created)
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
        count: totalTransactions,
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
