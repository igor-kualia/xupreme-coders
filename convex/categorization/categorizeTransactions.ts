import { internalAction, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { getMerchantName, normalizeMerchantName, getCategoryByName } from './helpers';
import { categorizeMerchantsWithLLM, CategoryInfo, MerchantToCategorizeLLM } from './llm';
import { Id } from '../_generated/dataModel';

const LLM_BATCH_SIZE = 100;

/**
 * Phase 1: Apply existing cached mappings to transactions
 */
export const applyMappingsToTransactions = internalMutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (ctx, { userId, bankAccountId }) => {
    // Get all transactions with pending or no categorization status
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('categoryId'), undefined),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      );

    const transactions = await transactionsQuery.collect();

    // Filter by bankAccountId if provided
    const filteredTransactions = bankAccountId
      ? transactions.filter((t) => t.bankAccountId === bankAccountId)
      : transactions;

    let appliedCount = 0;

    // For each transaction, try to find a cached mapping
    for (const transaction of filteredTransactions) {
      if (!transaction.merchantId) continue;

      const merchantName = await getMerchantName(ctx, transaction.merchantId);
      if (!merchantName) continue;

      const normalizedName = normalizeMerchantName(merchantName);

      // Look for cached mapping
      const mapping = await ctx.db
        .query('merchantCategoryMapping')
        .withIndex('by_userId_merchantName', (q) =>
          q.eq('userId', userId).eq('merchantName', normalizedName),
        )
        .first();

      if (mapping) {
        // Apply cached category
        await ctx.db.patch(transaction._id, {
          categoryId: mapping.categoryId,
          categorizationStatus: 'categorized',
          updatedAt: new Date().toISOString(),
        });

        // Update mapping stats
        await ctx.db.patch(mapping._id, {
          timesApplied: mapping.timesApplied + 1,
          updatedAt: new Date().toISOString(),
        });

        appliedCount++;
      }
    }

    console.log(`Applied ${appliedCount} cached mappings to transactions`);
    return { appliedCount };
  },
});

/**
 * Phase 2: Get uncategorized merchants that need LLM categorization
 */
export const getUncategorizedMerchants = internalMutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (ctx, { userId, bankAccountId }) => {
    // Get all transactions without categories
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('categoryId'), undefined),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      );

    const transactions = await transactionsQuery.collect();

    // Filter by bankAccountId if provided
    const filteredTransactions = bankAccountId
      ? transactions.filter((t) => t.bankAccountId === bankAccountId)
      : transactions;

    // Deduplicate merchants
    const merchantMap = new Map<string, { merchantId: Id<'merchant'>; merchantName: string }>();

    for (const transaction of filteredTransactions) {
      if (!transaction.merchantId) continue;

      const merchantName = await getMerchantName(ctx, transaction.merchantId);
      if (!merchantName) continue;

      const normalizedName = normalizeMerchantName(merchantName);

      if (!merchantMap.has(normalizedName)) {
        merchantMap.set(normalizedName, {
          merchantId: transaction.merchantId,
          merchantName,
        });
      }
    }

    const merchants = Array.from(merchantMap.values());
    console.log(`Found ${merchants.length} unique uncategorized merchants`);

    return {
      merchants: merchants.map((m) => ({
        merchantId: m.merchantId as string,
        merchantName: m.merchantName,
      })),
    };
  },
});

/**
 * Phase 3: Save LLM categorization results to mapping cache
 */
export const saveMappings = internalMutation({
  args: {
    userId: v.string(),
    mappings: v.array(
      v.object({
        merchantName: v.string(),
        categoryId: v.id('category'),
        confidence: v.number(),
      }),
    ),
  },
  handler: async (ctx, { userId, mappings }) => {
    let savedCount = 0;

    for (const mapping of mappings) {
      const normalizedName = normalizeMerchantName(mapping.merchantName);

      // Check if mapping already exists
      const existing = await ctx.db
        .query('merchantCategoryMapping')
        .withIndex('by_userId_merchantName', (q) =>
          q.eq('userId', userId).eq('merchantName', normalizedName),
        )
        .first();

      if (existing) {
        // Update existing mapping
        await ctx.db.patch(existing._id, {
          categoryId: mapping.categoryId,
          confidence: mapping.confidence,
          source: 'llm',
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new mapping
        await ctx.db.insert('merchantCategoryMapping', {
          userId,
          merchantName: normalizedName,
          categoryId: mapping.categoryId,
          confidence: mapping.confidence,
          source: 'llm',
          timesApplied: 0,
          timesOverridden: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      savedCount++;
    }

    console.log(`Saved ${savedCount} LLM categorization mappings`);
    return { savedCount };
  },
});

/**
 * Phase 3: Apply categories to transactions based on merchant
 */
export const applyCategoriesToTransactions = internalMutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
    merchantName: v.string(),
    categoryId: v.id('category'),
  },
  handler: async (ctx, { userId, bankAccountId, merchantName, categoryId }) => {
    const normalizedName = normalizeMerchantName(merchantName);

    // Get all transactions for this merchant
    const allTransactions = await ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('categoryId'), undefined),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      )
      .collect();

    // Filter by bankAccountId if provided
    const transactions = bankAccountId
      ? allTransactions.filter((t) => t.bankAccountId === bankAccountId)
      : allTransactions;

    let appliedCount = 0;

    for (const transaction of transactions) {
      if (!transaction.merchantId) continue;

      const txMerchantName = await getMerchantName(ctx, transaction.merchantId);
      if (!txMerchantName) continue;

      const txNormalizedName = normalizeMerchantName(txMerchantName);

      if (txNormalizedName === normalizedName) {
        await ctx.db.patch(transaction._id, {
          categoryId,
          categorizationStatus: 'categorized',
          updatedAt: new Date().toISOString(),
        });
        appliedCount++;
      }
    }

    return { appliedCount };
  },
});

/**
 * Batch apply categories to transactions for multiple merchants at once
 * This is much more efficient than calling applyCategoriesToTransactions per merchant
 */
export const batchApplyCategoriesToTransactions = internalMutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
    categorizations: v.array(
      v.object({
        merchantName: v.string(),
        categoryId: v.id('category'),
      }),
    ),
  },
  handler: async (ctx, { userId, bankAccountId, categorizations }) => {
    // Get all uncategorized transactions
    const allTransactions = await ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('categoryId'), undefined),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      )
      .collect();

    // Filter by bankAccountId if provided
    const transactions = bankAccountId
      ? allTransactions.filter((t) => t.bankAccountId === bankAccountId)
      : allTransactions;

    // Build a map of normalized merchant names to category IDs
    const merchantToCategoryMap = new Map<string, Id<'category'>>();
    for (const cat of categorizations) {
      const normalized = normalizeMerchantName(cat.merchantName);
      merchantToCategoryMap.set(normalized, cat.categoryId);
    }

    let appliedCount = 0;

    // Single pass through transactions
    for (const transaction of transactions) {
      if (!transaction.merchantId) continue;

      const txMerchantName = await getMerchantName(ctx, transaction.merchantId);
      if (!txMerchantName) continue;

      const txNormalizedName = normalizeMerchantName(txMerchantName);
      const categoryId = merchantToCategoryMap.get(txNormalizedName);

      if (categoryId) {
        await ctx.db.patch(transaction._id, {
          categoryId,
          categorizationStatus: 'categorized',
          updatedAt: new Date().toISOString(),
        });
        appliedCount++;
      }
    }

    return { appliedCount };
  },
});

/**
 * Mark transactions as "categorizing" when starting LLM categorization
 */
export const markTransactionsAsCategorizing = internalMutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (ctx, { userId, bankAccountId }) => {
    // Get all uncategorized transactions
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('categoryId'), undefined),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      );

    const transactions = await transactionsQuery.collect();

    // Filter by bankAccountId if provided
    const filteredTransactions = bankAccountId
      ? transactions.filter((t) => t.bankAccountId === bankAccountId)
      : transactions;

    let markedCount = 0;
    for (const transaction of filteredTransactions) {
      await ctx.db.patch(transaction._id, {
        categorizationStatus: 'categorizing',
        updatedAt: new Date().toISOString(),
      });
      markedCount++;
    }

    console.log(`Marked ${markedCount} transactions as categorizing`);
    return { markedCount };
  },
});

/**
 * Mark remaining uncategorized transactions as failed
 */
export const markRemainingAsFailed = internalMutation({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (ctx, { userId, bankAccountId }) => {
    // Get all transactions still marked as "categorizing" without a category
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('categoryId'), undefined),
          q.eq(q.field('categorizationStatus'), 'categorizing'),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      );

    const transactions = await transactionsQuery.collect();

    // Filter by bankAccountId if provided
    const filteredTransactions = bankAccountId
      ? transactions.filter((t) => t.bankAccountId === bankAccountId)
      : transactions;

    let failedCount = 0;
    for (const transaction of filteredTransactions) {
      await ctx.db.patch(transaction._id, {
        categorizationStatus: 'failed',
        updatedAt: new Date().toISOString(),
      });
      failedCount++;
    }

    console.log(`Marked ${failedCount} transactions as failed`);
    return { failedCount };
  },
});

/**
 * Get all available categories for the user
 */
export const getAllCategories = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const categories: CategoryInfo[] = [];

    // Get all user category groups
    const userGroups = await ctx.db
      .query('categoryGroup')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)))
      .collect();

    // Get all user categories
    const userCategories = await ctx.db
      .query('category')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)))
      .collect();

    // Build category info with groups
    for (const category of userCategories) {
      let groupName = 'Other';

      if (category.categoryGroupId) {
        const group = userGroups.find((g) => g._id === category.categoryGroupId);
        if (group) {
          groupName = group.name;
        }
      }

      categories.push({
        name: category.name,
        groupName,
        formattedName: `[${groupName}][${category.name}]`,
      });
    }

    return { categories };
  },
});

/**
 * Main orchestrator: Categorize transactions using 4-phase system
 * Phase 1: Apply cached mappings
 * Phase 2: Identify uncategorized merchants
 * Phase 3: Call LLM in batches, save mappings, apply to transactions
 * Phase 4: Complete
 */
export const categorizeTransactions = internalAction({
  args: {
    userId: v.string(),
    bankAccountId: v.optional(v.id('bankAccount')),
  },
  handler: async (
    ctx,
    { userId, bankAccountId },
  ): Promise<{
    success: boolean;
    categorizedCount: number;
    cachedCount?: number;
    llmCount?: number;
  }> => {
    console.log(`Starting categorization for userId: ${userId}`);

    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    // PHASE 1: Apply existing cached mappings
    console.log('Phase 1: Applying cached mappings...');
    const phase1Result = await ctx.runMutation(
      internal.categorization.categorizeTransactions.applyMappingsToTransactions,
      {
        userId,
        bankAccountId,
      },
    );
    console.log(`Phase 1 complete: Applied ${phase1Result.appliedCount} cached mappings`);

    // PHASE 2: Identify uncategorized merchants
    console.log('Phase 2: Identifying uncategorized merchants...');
    const phase2Result = await ctx.runMutation(
      internal.categorization.categorizeTransactions.getUncategorizedMerchants,
      {
        userId,
        bankAccountId,
      },
    );
    const uncategorizedMerchants = phase2Result.merchants;
    console.log(`Phase 2 complete: Found ${uncategorizedMerchants.length} uncategorized merchants`);

    if (uncategorizedMerchants.length === 0) {
      console.log('No uncategorized merchants found. Categorization complete.');
      return { success: true, categorizedCount: phase1Result.appliedCount };
    }

    // Mark remaining transactions as "categorizing"
    await ctx.runMutation(
      internal.categorization.categorizeTransactions.markTransactionsAsCategorizing,
      {
        userId,
        bankAccountId,
      },
    );

    // Get all available categories
    const categoriesResult = await ctx.runMutation(
      internal.categorization.categorizeTransactions.getAllCategories,
      {
        userId,
      },
    );
    const categories = categoriesResult.categories;

    // PHASE 3: LLM categorization in batches
    console.log('Phase 3: Running LLM categorization...');
    let totalCategorized = 0;

    for (let i = 0; i < uncategorizedMerchants.length; i += LLM_BATCH_SIZE) {
      const batch = uncategorizedMerchants.slice(i, i + LLM_BATCH_SIZE);
      console.log(`Processing batch ${i / LLM_BATCH_SIZE + 1} (${batch.length} merchants)...`);

      try {
        // Call LLM
        const llmResults = await categorizeMerchantsWithLLM(
          apiKey,
          batch as MerchantToCategorizeLLM[],
          categories,
        );

        console.log(`LLM returned ${llmResults.length} categorization results`);

        // Batch lookup all category IDs at once
        const categoryLookups = llmResults.map((result) => ({
          categoryName: result.categoryName,
          groupName: result.groupName ?? undefined,
        }));

        const categoryResults = await ctx.runMutation(
          internal.categorization.categorizeTransactions.batchFindCategoriesByName,
          {
            userId,
            categories: categoryLookups,
          },
        );

        // Build mappings and categorizations
        const mappingsToSave = [];
        const categoriesToApply = [];

        for (let i = 0; i < llmResults.length; i++) {
          const result = llmResults[i];
          const categoryLookup = categoryResults.results[i];

          if (!categoryLookup.categoryId) {
            console.warn(`Category not found for: [${result.groupName}][${result.categoryName}]`);
            continue;
          }

          mappingsToSave.push({
            merchantName: result.merchantName,
            categoryId: categoryLookup.categoryId,
            confidence: result.confidence,
          });

          categoriesToApply.push({
            merchantName: result.merchantName,
            categoryId: categoryLookup.categoryId,
          });
        }

        // Batch save all mappings at once
        if (mappingsToSave.length > 0) {
          await ctx.runMutation(internal.categorization.categorizeTransactions.saveMappings, {
            userId,
            mappings: mappingsToSave,
          });
          console.log(`Saved ${mappingsToSave.length} mappings`);
        }

        // Batch apply categories to all transactions
        if (categoriesToApply.length > 0) {
          const applyResult = await ctx.runMutation(
            internal.categorization.categorizeTransactions.batchApplyCategoriesToTransactions,
            {
              userId,
              bankAccountId,
              categorizations: categoriesToApply,
            },
          );

          totalCategorized += applyResult.appliedCount;
          console.log(`Applied categories to ${applyResult.appliedCount} transactions`);
        }
      } catch (error) {
        console.error(`Error processing batch: ${error}`);
        // Continue with next batch even if one fails
      }
    }

    console.log(`Phase 3 complete: Categorized ${totalCategorized} transactions via LLM`);

    // PHASE 4: Mark remaining transactions as failed
    console.log('Phase 4: Marking remaining transactions as failed...');
    const phase4Result = await ctx.runMutation(
      internal.categorization.categorizeTransactions.markRemainingAsFailed,
      {
        userId,
        bankAccountId,
      },
    );
    console.log(`Phase 4 complete: Marked ${phase4Result.failedCount} transactions as failed`);

    // Complete
    const totalApplied = phase1Result.appliedCount + totalCategorized;
    console.log(`Categorization complete. Total transactions categorized: ${totalApplied}`);

    return {
      success: true,
      categorizedCount: totalApplied,
      cachedCount: phase1Result.appliedCount,
      llmCount: totalCategorized,
    };
  },
});

/**
 * Helper mutation to find category by name (needed for action context)
 */
export const findCategoryByNameMutation = internalMutation({
  args: {
    userId: v.string(),
    categoryName: v.string(),
    groupName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, categoryName, groupName }) => {
    return await getCategoryByName(ctx, userId, categoryName, groupName);
  },
});

/**
 * Batch find multiple categories by name at once
 */
export const batchFindCategoriesByName = internalMutation({
  args: {
    userId: v.string(),
    categories: v.array(
      v.object({
        categoryName: v.string(),
        groupName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { userId, categories }) => {
    const results: Array<{
      categoryName: string;
      groupName?: string;
      categoryId: Id<'category'> | null;
    }> = [];

    for (const cat of categories) {
      const categoryId = await getCategoryByName(ctx, userId, cat.categoryName, cat.groupName);
      results.push({
        categoryName: cat.categoryName,
        groupName: cat.groupName,
        categoryId,
      });
    }

    return { results };
  },
});
