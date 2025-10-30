/**
 * Category aggregation queries for chat visualizations
 */

import { query } from './_generated/server';
import { v } from 'convex/values';

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryIconName?: string;
  groupName?: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  averagePerTransaction: number;
  type: 'income' | 'expense' | 'transfer';
}

/**
 * Get category summary data for visualization
 * Aggregates transactions by category and returns detailed stats
 */
export const getCategorySummary = query({
  args: {
    categoryIds: v.array(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    transactionType: v.optional(
      v.union(v.literal('income'), v.literal('expense'), v.literal('transfer'), v.literal('all')),
    ),
  },
  handler: async (ctx, args): Promise<CategorySummary[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    // Fetch all transactions for the user
    let transactions = await ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect();

    // Apply date filters
    if (args.startDate) {
      transactions = transactions.filter((t) => t.date >= args.startDate!);
    }
    if (args.endDate) {
      transactions = transactions.filter((t) => t.date <= args.endDate!);
    }

    // Apply transaction type filter
    if (args.transactionType && args.transactionType !== 'all') {
      if (args.transactionType === 'expense') {
        transactions = transactions.filter((t) => Number(t.amount) < 0);
      } else if (args.transactionType === 'income') {
        transactions = transactions.filter((t) => Number(t.amount) > 0);
      } else if (args.transactionType === 'transfer') {
        transactions = transactions.filter((t) => Number(t.amount) === 0);
      }
    }

    // Filter by category IDs
    transactions = transactions.filter(
      (t) => t.categoryId && args.categoryIds.includes(t.categoryId),
    );

    // Aggregate by category
    const categoryMap = new Map<
      string,
      { categoryId: string; transactions: number; total: number }
    >();

    for (const t of transactions) {
      if (!t.categoryId) continue;

      const amount = Math.abs(Number(t.amount));
      if (!categoryMap.has(t.categoryId)) {
        categoryMap.set(t.categoryId, { categoryId: t.categoryId, transactions: 0, total: 0 });
      }

      const entry = categoryMap.get(t.categoryId)!;
      entry.transactions++;
      entry.total += amount;
    }

    // Calculate grand total for percentages
    const grandTotal = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.total, 0);

    // Build summary for each category
    const summaries: CategorySummary[] = [];

    for (const [categoryId, data] of categoryMap.entries()) {
      // Fetch category details
      const category = await ctx.db.get(categoryId as any);
      if (!category || !('name' in category)) continue;

      let groupName: string | undefined;
      let type: 'income' | 'expense' | 'transfer' = 'expense';

      if ('categoryGroupId' in category && category.categoryGroupId) {
        const group = await ctx.db.get(category.categoryGroupId);
        if (group && 'name' in group && 'type' in group) {
          groupName = group.name;
          type = group.type;
        }
      }

      summaries.push({
        categoryId,
        categoryName: category.name || 'Unknown',
        categoryIconName: 'iconName' in category ? category.iconName : undefined,
        groupName,
        totalAmount: data.total,
        transactionCount: data.transactions,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
        averagePerTransaction: data.transactions > 0 ? data.total / data.transactions : 0,
        type,
      });
    }

    // Sort by total amount descending
    return summaries.sort((a, b) => b.totalAmount - a.totalAmount);
  },
});
