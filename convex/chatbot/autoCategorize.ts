/**
 * Autonomous transaction categorization by merchant
 * This allows the chatbot to categorize uncategorized transactions without confirmation
 */

import { ActionCtx, internalMutation, internalQuery } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import {
  getCategoryByName,
  normalizeMerchantName,
  parseCategoryFromLLM,
} from '../categorization/helpers';

/**
 * Input type for auto categorize by merchant
 */
export interface AutoCategorizeByMerchantInput {
  merchantName: string;
  categoryName: string;
}

/**
 * Auto-categorize all uncategorized transactions from a specific merchant
 * This is used when the user wants to bulk categorize transactions by merchant name
 * without the two-step confirmation process
 */
export async function executeAutoCategorizeByMerchant(
  ctx: ActionCtx,
  userId: string,
  input: AutoCategorizeByMerchantInput,
): Promise<string> {
  try {
    const { merchantName, categoryName } = input;

    // Parse category name (supports "[Group][Category]" format)
    const { categoryName: parsedCategoryName, groupName } = parseCategoryFromLLM(categoryName);

    // Find the category
    const categoryId = await ctx.runQuery(internal.chatbot.autoCategorize.findCategoryByName, {
      userId,
      categoryName: parsedCategoryName,
      groupName: groupName ?? undefined,
    });

    if (!categoryId) {
      return `Error: Could not find category "${categoryName}". Please check the category name and try again. You can use the list_categories tool to see available categories.`;
    }

    // Normalize merchant name
    const normalizedMerchantName = normalizeMerchantName(merchantName);

    // Find or create merchant-category mapping
    await ctx.runMutation(internal.chatbot.autoCategorize.upsertMerchantCategoryMapping, {
      userId,
      merchantName: normalizedMerchantName,
      categoryId,
      source: 'manual',
    });

    // Apply categorization to all uncategorized transactions from this merchant
    const result = await ctx.runMutation(
      internal.chatbot.autoCategorize.applyCategorizationToTransactions,
      {
        userId,
        merchantName: normalizedMerchantName,
        categoryId,
      },
    );

    // Get category name for response
    const fullCategoryName = groupName
      ? `${groupName} > ${parsedCategoryName}`
      : parsedCategoryName;

    if (result.updatedCount === 0) {
      return `No uncategorized transactions found for merchant "${merchantName}". All transactions from this merchant may already be categorized.`;
    }

    return `✓ Successfully categorized ${result.updatedCount} transaction${result.updatedCount === 1 ? '' : 's'} from "${merchantName}" as "${fullCategoryName}".`;
  } catch (error) {
    console.error('Error in executeAutoCategorizeByMerchant:', error);
    return `Error categorizing transactions: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Internal query to find category by name
 */
export const findCategoryByName = internalQuery({
  args: {
    userId: v.string(),
    categoryName: v.string(),
    groupName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await getCategoryByName(ctx, args.userId, args.categoryName, args.groupName);
  },
});

/**
 * Internal mutation to upsert merchant-category mapping
 */
export const upsertMerchantCategoryMapping = internalMutation({
  args: {
    userId: v.string(),
    merchantName: v.string(),
    categoryId: v.string(),
    source: v.union(v.literal('llm'), v.literal('manual')),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Check if mapping already exists
    const existing = await ctx.db
      .query('merchantCategoryMapping')
      .withIndex('by_userId_merchantName', (q) =>
        q.eq('userId', args.userId).eq('merchantName', args.merchantName),
      )
      .first();

    if (existing) {
      // Update existing mapping
      await ctx.db.patch(existing._id, {
        categoryId: args.categoryId as Id<'category'>,
        source: args.source,
        updatedAt: now,
      });
      return { mappingId: existing._id, isNew: false };
    } else {
      // Create new mapping
      const mappingId = await ctx.db.insert('merchantCategoryMapping', {
        userId: args.userId,
        merchantName: args.merchantName,
        categoryId: args.categoryId as Id<'category'>,
        source: args.source,
        timesApplied: 0,
        timesOverridden: 0,
        createdAt: now,
        updatedAt: now,
      });
      return { mappingId, isNew: true };
    }
  },
});

/**
 * Internal mutation to apply categorization to all uncategorized transactions from a merchant
 */
export const applyCategorizationToTransactions = internalMutation({
  args: {
    userId: v.string(),
    merchantName: v.string(),
    categoryId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all merchants with matching normalized name
    const merchants = await ctx.db
      .query('merchant')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => q.neq(q.field('isDeleted'), true))
      .collect();

    // Filter merchants by normalized name match
    const matchingMerchants = merchants.filter((m) => {
      const merchantName = m.name || '';
      return normalizeMerchantName(merchantName) === args.merchantName;
    });

    if (matchingMerchants.length === 0) {
      return { updatedCount: 0 };
    }

    const merchantIds = matchingMerchants.map((m) => m._id);

    // Find all uncategorized transactions from these merchants
    let updatedCount = 0;
    for (const merchantId of merchantIds) {
      const transactions = await ctx.db
        .query('transaction')
        .withIndex('by_userId_merchantId', (q) =>
          q.eq('userId', args.userId).eq('merchantId', merchantId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field('isDeleted'), false),
            q.or(
              q.eq(q.field('categoryId'), undefined),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              q.eq(q.field('categoryId'), null as any),
            ),
          ),
        )
        .collect();

      // Update each transaction
      for (const transaction of transactions) {
        await ctx.db.patch(transaction._id, {
          categoryId: args.categoryId as Id<'category'>,
          categorizationStatus: 'categorized',
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      }
    }

    // Update timesApplied count on the mapping
    if (updatedCount > 0) {
      const mapping = await ctx.db
        .query('merchantCategoryMapping')
        .withIndex('by_userId_merchantName', (q) =>
          q.eq('userId', args.userId).eq('merchantName', args.merchantName),
        )
        .first();

      if (mapping) {
        await ctx.db.patch(mapping._id, {
          timesApplied: mapping.timesApplied + updatedCount,
        });
      }
    }

    return { updatedCount };
  },
});
