/**
 * Transaction queries and mutations
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';

/**
 * Extended transaction type with populated merchant and category
 */
export interface TransactionWithDetails extends Doc<'transaction'> {
  merchant?: {
    _id: Doc<'merchant'>['_id'];
    name: string;
    logoUrl?: string;
  };
  category?: {
    _id: Doc<'category'>['_id'];
    name: string;
    iconName?: string;
  };
  bankAccount?: {
    _id: Doc<'bankAccount'>['_id'];
    name: string;
    accountType: string;
  };
}

/**
 * Lists transactions for the authenticated user
 * Supports filtering by date range, category, merchant, and bank account
 * Now with limit-based pagination for lazy loading
 */
export const listTransactions = query({
  args: {
    limit: v.optional(v.number()),
    bankAccountId: v.optional(v.id('bankAccount')),
    categoryId: v.optional(v.id('category')),
    merchantId: v.optional(v.id('merchant')),
    startDate: v.optional(v.string()), // ISO date string
    endDate: v.optional(v.string()), // ISO date string
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;
    const limit = args.limit ?? 50;

    // Build the query based on filters
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('isDeleted'), false));

    // Apply filters
    if (args.bankAccountId) {
      transactionsQuery = transactionsQuery.filter((q) =>
        q.eq(q.field('bankAccountId'), args.bankAccountId!),
      );
    }

    if (args.categoryId) {
      transactionsQuery = transactionsQuery.filter((q) =>
        q.eq(q.field('categoryId'), args.categoryId!),
      );
    }

    if (args.merchantId) {
      transactionsQuery = transactionsQuery.filter((q) =>
        q.eq(q.field('merchantId'), args.merchantId!),
      );
    }

    if (args.startDate) {
      transactionsQuery = transactionsQuery.filter((q) => q.gte(q.field('date'), args.startDate!));
    }

    if (args.endDate) {
      transactionsQuery = transactionsQuery.filter((q) => q.lte(q.field('date'), args.endDate!));
    }

    // Execute query - collect all matching transactions
    const allTransactions = await transactionsQuery.collect();

    // Sort by date (most recent first), then by _creationTime as tiebreaker
    const sortedTransactions = allTransactions.sort((a, b) => {
      // First sort by date descending (most recent first)
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      // If dates are equal, sort by creation time descending
      return b._creationTime - a._creationTime;
    });

    // Take only the requested limit
    const transactions = sortedTransactions.slice(0, limit);

    // Populate merchant and category details
    const transactionsWithDetails: TransactionWithDetails[] = await Promise.all(
      transactions.map(async (transaction) => {
        const details: TransactionWithDetails = { ...transaction };

        // Populate merchant
        if (transaction.merchantId) {
          const merchant = await ctx.db.get(transaction.merchantId);
          if (merchant) {
            // Get merchant name (from custom or global)
            let merchantName = merchant.name;
            let merchantLogoUrl = merchant.logoUrl ?? undefined;

            if (merchant.globalMerchantId && !merchantName) {
              const globalMerchant = await ctx.db.get(merchant.globalMerchantId);
              if (globalMerchant) {
                merchantName = globalMerchant.name;
                if (!merchantLogoUrl) {
                  merchantLogoUrl = globalMerchant.logoUrl;
                }
              }
            }

            details.merchant = {
              _id: merchant._id,
              name: merchantName || 'Unknown Merchant',
              logoUrl: merchantLogoUrl,
            };
          }
        }

        // Populate category
        if (transaction.categoryId) {
          const category = await ctx.db.get(transaction.categoryId);
          if (category) {
            details.category = {
              _id: category._id,
              name: category.name,
              iconName: category.iconName,
            };
          }
        }

        // Populate bank account
        const bankAccount = (await ctx.db.get(
          transaction.bankAccountId,
        )) as Doc<'bankAccount'> | null;
        if (bankAccount) {
          details.bankAccount = {
            _id: bankAccount._id,
            name: bankAccount.name,
            accountType: bankAccount.accountType,
          };
        }

        return details;
      }),
    );

    return {
      transactions: transactionsWithDetails,
      continueCursor: null,
      isDone: transactionsWithDetails.length < limit,
    };
  },
});

/**
 * Gets a single transaction by ID
 */
export const getTransaction = query({
  args: {
    transactionId: v.id('transaction'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;
    const transaction = await ctx.db.get(args.transactionId);

    if (!transaction) {
      return null;
    }

    // Verify ownership
    if (transaction.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Populate details
    const details: TransactionWithDetails = { ...transaction };

    if (transaction.merchantId) {
      const merchant = await ctx.db.get(transaction.merchantId);
      if (merchant) {
        let merchantName = merchant.name;
        let merchantLogoUrl = merchant.logoUrl ?? undefined;

        if (merchant.globalMerchantId && !merchantName) {
          const globalMerchant = await ctx.db.get(merchant.globalMerchantId);
          if (globalMerchant) {
            merchantName = globalMerchant.name;
            merchantLogoUrl = globalMerchant.logoUrl;
          }
        }

        details.merchant = {
          _id: merchant._id,
          name: merchantName || 'Unknown Merchant',
          logoUrl: merchantLogoUrl,
        };
      }
    }

    if (transaction.categoryId) {
      const category = await ctx.db.get(transaction.categoryId);
      if (category) {
        details.category = {
          _id: category._id,
          name: category.name,
          iconName: category.iconName,
        };
      }
    }

    const bankAccount = (await ctx.db.get(transaction.bankAccountId)) as Doc<'bankAccount'> | null;
    if (bankAccount) {
      details.bankAccount = {
        _id: bankAccount._id,
        name: bankAccount.name,
        accountType: bankAccount.accountType,
      };
    }

    return details;
  },
});

/**
 * Gets transaction summary statistics for the user
 */
export const getTransactionSummary = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;

    // Get all transactions for the user
    let transactionsQuery = ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('isDeleted'), false));

    if (args.startDate) {
      transactionsQuery = transactionsQuery.filter((q) => q.gte(q.field('date'), args.startDate!));
    }

    if (args.endDate) {
      transactionsQuery = transactionsQuery.filter((q) => q.lte(q.field('date'), args.endDate!));
    }

    const transactions = await transactionsQuery.collect();

    // Calculate summary statistics
    let totalIncome = BigInt(0);
    let totalExpenses = BigInt(0);
    const categoryTotals: Record<string, bigint> = {};
    const merchantTotals: Record<string, bigint> = {};

    for (const transaction of transactions) {
      const amount = transaction.amount;

      if (amount > 0) {
        totalIncome += amount;
      } else {
        totalExpenses += -amount;
      }

      // Group by category
      if (transaction.categoryId) {
        const key = transaction.categoryId;
        categoryTotals[key] = (categoryTotals[key] || BigInt(0)) + BigInt(Math.abs(Number(amount)));
      }

      // Group by merchant
      if (transaction.merchantId) {
        const key = transaction.merchantId;
        merchantTotals[key] = (merchantTotals[key] || BigInt(0)) + BigInt(Math.abs(Number(amount)));
      }
    }

    return {
      totalTransactions: transactions.length,
      totalIncome: Number(totalIncome),
      totalExpenses: Number(totalExpenses),
      netAmount: Number(totalIncome - totalExpenses),
      categoryTotals: Object.fromEntries(
        Object.entries(categoryTotals).map(([k, v]) => [k, Number(v)]),
      ),
      merchantTotals: Object.fromEntries(
        Object.entries(merchantTotals).map(([k, v]) => [k, Number(v)]),
      ),
    };
  },
});

/**
 * Gets multiple transactions by their IDs
 * Used by chat to display specific transactions
 * Accepts strings to handle potentially invalid/stale IDs from chat history
 */
export const getTransactionsByIds = query({
  args: {
    transactionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;

    // Fetch all transactions by ID, handling invalid IDs gracefully
    const transactions = await Promise.all(
      args.transactionIds.map(async (id) => {
        try {
          // Attempt to get the transaction - this may fail if ID is invalid
          const transaction = (await ctx.db.get(
            id as Id<'transaction'>,
          )) as Doc<'transaction'> | null;
          if (!transaction) return null;

          // Verify ownership
          if (transaction.userId !== userId) {
            return null;
          }

          // Skip deleted transactions
          if (transaction.isDeleted) {
            return null;
          }

          return transaction;
        } catch {
          // Invalid ID format or doesn't exist - skip it
          return null;
        }
      }),
    );

    // Filter out null values
    const validTransactions = transactions.filter((t): t is Doc<'transaction'> => t !== null);

    // Populate merchant and category details
    const transactionsWithDetails: TransactionWithDetails[] = await Promise.all(
      validTransactions.map(async (transaction) => {
        const details: TransactionWithDetails = { ...transaction };

        // Populate merchant
        if (transaction.merchantId) {
          const merchant = await ctx.db.get(transaction.merchantId);
          if (merchant) {
            // Get merchant name (from custom or global)
            let merchantName = merchant.name;
            let merchantLogoUrl = merchant.logoUrl ?? undefined;

            if (merchant.globalMerchantId && !merchantName) {
              const globalMerchant = await ctx.db.get(merchant.globalMerchantId);
              if (globalMerchant) {
                merchantName = globalMerchant.name;
                if (!merchantLogoUrl) {
                  merchantLogoUrl = globalMerchant.logoUrl;
                }
              }
            }

            details.merchant = {
              _id: merchant._id,
              name: merchantName || 'Unknown Merchant',
              logoUrl: merchantLogoUrl,
            };
          }
        }

        // Populate category
        if (transaction.categoryId) {
          const category = await ctx.db.get(transaction.categoryId);
          if (category) {
            details.category = {
              _id: category._id,
              name: category.name,
              iconName: category.iconName,
            };
          }
        }

        // Populate bank account
        const bankAccount = (await ctx.db.get(
          transaction.bankAccountId,
        )) as Doc<'bankAccount'> | null;
        if (bankAccount) {
          details.bankAccount = {
            _id: bankAccount._id,
            name: bankAccount.name,
            accountType: bankAccount.accountType,
          };
        }

        return details;
      }),
    );

    return transactionsWithDetails;
  },
});

/**
 * Updates one or more transactions
 * Supports updating category, date, and amount
 * Validates all inputs and user ownership
 */
export const updateTransactions = mutation({
  args: {
    transactionIds: v.array(v.id('transaction')),
    updates: v.object({
      categoryId: v.optional(v.id('category')),
      date: v.optional(v.string()),
      amount: v.optional(v.int64()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;

    // Validate that at least one update is provided
    if (
      args.updates.categoryId === undefined &&
      args.updates.date === undefined &&
      args.updates.amount === undefined
    ) {
      throw new Error('At least one field must be updated');
    }

    // Validate category exists if provided
    if (args.updates.categoryId !== undefined) {
      const category = await ctx.db.get(args.updates.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
      // Verify category belongs to user or is a system category
      if (category.userId && category.userId !== userId) {
        throw new Error('Category not found');
      }
    }

    // Validate date format if provided (should be ISO date string)
    if (args.updates.date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(args.updates.date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      // Additional validation: ensure it's a valid date
      const date = new Date(args.updates.date);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date value');
      }
    }

    // Validate amount if provided
    if (args.updates.amount !== undefined) {
      // Amount should be a reasonable value (not too large)
      const MAX_AMOUNT = BigInt(1000000000000); // $10 billion in cents
      if (args.updates.amount > MAX_AMOUNT || args.updates.amount < -MAX_AMOUNT) {
        throw new Error('Amount is out of valid range');
      }
    }

    // Fetch all transactions and verify ownership
    const transactions = await Promise.all(
      args.transactionIds.map(async (id) => {
        const transaction = await ctx.db.get(id);
        if (!transaction) {
          throw new Error(`Transaction ${id} not found`);
        }
        if (transaction.userId !== userId) {
          throw new Error(`Unauthorized access to transaction ${id}`);
        }
        if (transaction.isDeleted) {
          throw new Error(`Transaction ${id} has been deleted`);
        }
        return transaction;
      }),
    );

    // Build the update object
    const updateData: Partial<Doc<'transaction'>> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.updates.categoryId !== undefined) {
      updateData.categoryId = args.updates.categoryId;
    }
    if (args.updates.date !== undefined) {
      updateData.date = args.updates.date;
    }
    if (args.updates.amount !== undefined) {
      updateData.amount = args.updates.amount;
    }

    // Update all transactions
    await Promise.all(
      transactions.map(async (transaction) => {
        await ctx.db.patch(transaction._id, updateData);
      }),
    );

    // Fetch updated transactions with details
    const updatedTransactions = await Promise.all(
      args.transactionIds.map(async (id) => {
        const transaction = (await ctx.db.get(id)) as Doc<'transaction'>;
        const details: TransactionWithDetails = { ...transaction };

        // Populate merchant
        if (transaction.merchantId) {
          const merchant = await ctx.db.get(transaction.merchantId);
          if (merchant) {
            let merchantName = merchant.name;
            let merchantLogoUrl = merchant.logoUrl ?? undefined;

            if (merchant.globalMerchantId && !merchantName) {
              const globalMerchant = await ctx.db.get(merchant.globalMerchantId);
              if (globalMerchant) {
                merchantName = globalMerchant.name;
                if (!merchantLogoUrl) {
                  merchantLogoUrl = globalMerchant.logoUrl;
                }
              }
            }

            details.merchant = {
              _id: merchant._id,
              name: merchantName || 'Unknown Merchant',
              logoUrl: merchantLogoUrl,
            };
          }
        }

        // Populate category
        if (transaction.categoryId) {
          const category = await ctx.db.get(transaction.categoryId);
          if (category) {
            details.category = {
              _id: category._id,
              name: category.name,
              iconName: category.iconName,
            };
          }
        }

        // Populate bank account
        const bankAccount = (await ctx.db.get(
          transaction.bankAccountId,
        )) as Doc<'bankAccount'> | null;
        if (bankAccount) {
          details.bankAccount = {
            _id: bankAccount._id,
            name: bankAccount.name,
            accountType: bankAccount.accountType,
          };
        }

        return details;
      }),
    );

    return {
      success: true,
      updatedCount: updatedTransactions.length,
      transactions: updatedTransactions,
    };
  },
});
