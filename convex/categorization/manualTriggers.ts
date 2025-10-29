/**
 * Utility functions for categorization management
 * Can be called from the Convex dashboard for testing/debugging
 */

import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get categorization status for a user
 * Shows how many transactions are in each status
 *
 * Example usage in dashboard:
 * await query('categorization/manualTriggers:getCategorizationStatus', {
 *   userId: 'user|123456'
 * })
 */
export const getCategorizationStatus = query({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (ctx, { userId, bankAccountId }) => {
    // Get all transactions for this user
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
      );

    const allTransactions = await transactionsQuery.collect();

    // Filter by bankAccountId if provided
    const transactions = bankAccountId
      ? allTransactions.filter((t) => t.bankAccountId === bankAccountId)
      : allTransactions;

    // Count transactions by status
    const statusCounts = {
      pending: 0,
      categorizing: 0,
      categorized: 0,
      failed: 0,
      manual: 0,
      none: 0, // No status set
      total: transactions.length,
    };

    for (const transaction of transactions) {
      const status = transaction.categorizationStatus;
      if (!status) {
        statusCounts.none++;
      } else {
        statusCounts[status]++;
      }
    }

    // Calculate percentage categorized
    const categorizedCount = statusCounts.categorized + statusCounts.manual;
    const percentageCategorized =
      transactions.length > 0 ? ((categorizedCount / transactions.length) * 100).toFixed(2) : '0';

    return {
      userId,
      bankAccountId: bankAccountId ?? null,
      statusCounts,
      percentageCategorized: `${percentageCategorized}%`,
      totalTransactions: transactions.length,
    };
  },
});

/**
 * Reset all transactions to pending status
 * Useful for re-running categorization from scratch
 *
 * Example usage in dashboard:
 * await mutation('categorization/manualTriggers:resetCategorizationStatus', {
 *   userId: 'user|123456'
 * })
 */
export const resetCategorizationStatus = mutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (ctx, { userId, bankAccountId }) => {
    // Get all transactions for this user
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
      );

    const allTransactions = await transactionsQuery.collect();

    // Filter by bankAccountId if provided
    const transactions = bankAccountId
      ? allTransactions.filter((t) => t.bankAccountId === bankAccountId)
      : allTransactions;

    let resetCount = 0;
    for (const transaction of transactions) {
      // Only reset if not manually categorized
      if (transaction.categorizationStatus !== 'manual') {
        await ctx.db.patch(transaction._id, {
          categoryId: undefined,
          categorizationStatus: 'pending',
          updatedAt: new Date().toISOString(),
        });
        resetCount++;
      }
    }

    console.log(`Reset ${resetCount} transactions to pending status`);
    return {
      success: true,
      resetCount,
      totalTransactions: transactions.length,
    };
  },
});

/**
 * Clear all merchant category mappings for a user
 * Useful for testing LLM categorization with fresh results
 *
 * Example usage in dashboard:
 * await mutation('categorization/manualTriggers:clearMerchantMappings', {
 *   userId: 'user|123456'
 * })
 */
export const clearMerchantMappings = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // Get all mappings for this user
    const mappings = await ctx.db
      .query('merchantCategoryMapping')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    let deletedCount = 0;
    for (const mapping of mappings) {
      await ctx.db.delete(mapping._id);
      deletedCount++;
    }

    console.log(`Cleared ${deletedCount} merchant mappings`);
    return {
      success: true,
      deletedCount,
    };
  },
});
