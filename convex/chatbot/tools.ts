/**
 * Tool definitions and execution logic for the chatbot
 */

import { ActionCtx, internalQuery } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { formatCurrency, formatDate } from './helpers';

/**
 * Tool definition for listing categories
 */
export const LIST_CATEGORIES_TOOL = {
  name: 'list_categories',
  description: `List all available spending categories for the user.
Use this tool to find category IDs when the user asks about specific categories by name (e.g., "groceries", "restaurants", "utilities").
Returns category ID, name, group, and type information.`,
  input_schema: {
    type: 'object',
    properties: {
      searchTerm: {
        type: 'string',
        description: 'Optional search term to filter categories by name (case-insensitive)',
      },
    },
  },
} as const;

/**
 * Tool definition for listing merchants
 */
export const LIST_MERCHANTS_TOOL = {
  name: 'list_merchants',
  description: `List all merchants from the user's transactions.
Use this tool to find merchant IDs when the user asks about specific merchants or stores (e.g., "Walmart", "Starbucks").
Returns merchant ID, name, and transaction count.`,
  input_schema: {
    type: 'object',
    properties: {
      searchTerm: {
        type: 'string',
        description: 'Optional search term to filter merchants by name (case-insensitive)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of merchants to return (default: 50)',
      },
    },
  },
} as const;

/**
 * Tool definition for querying transactions
 */
export const QUERY_TRANSACTIONS_TOOL = {
  name: 'query_transactions',
  description: `Query individual financial transactions with powerful filtering and aggregation capabilities.
USE THIS TOOL when users ask about:
- Specific transactions or expenses (e.g., "top 5 expenses", "my largest purchases", "recent transactions")
- Transactions at specific merchants (e.g., "what did I buy at Walmart?")
- Total spending in a specific category (e.g., "how much did I spend on groceries?")

DO NOT USE THIS TOOL for category breakdowns or "top spending categories" (use get_category_summary instead).

IMPORTANT: Use list_categories or list_merchants tools first to find the correct IDs before filtering by category or merchant.`,
  input_schema: {
    type: 'object',
    properties: {
      dateRange: {
        type: 'object',
        description: 'Filter transactions by date range (ISO 8601 format)',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date in ISO format (e.g., "2024-01-01T00:00:00.000Z")',
          },
          endDate: {
            type: 'string',
            description: 'End date in ISO format (e.g., "2024-12-31T23:59:59.999Z")',
          },
        },
      },
      amountRange: {
        type: 'object',
        description: 'Filter transactions by amount range (in cents, negative for expenses)',
        properties: {
          min: {
            type: 'number',
            description: 'Minimum amount in cents (e.g., -50000 for expenses up to $500)',
          },
          max: {
            type: 'number',
            description: 'Maximum amount in cents (e.g., 10000 for income up to $100)',
          },
        },
      },
      accountIds: {
        type: 'array',
        description: 'Filter by specific bank account IDs',
        items: {
          type: 'string',
        },
      },
      categoryIds: {
        type: 'array',
        description: 'Filter by specific category IDs',
        items: {
          type: 'string',
        },
      },
      merchantIds: {
        type: 'array',
        description: 'Filter by specific merchant IDs',
        items: {
          type: 'string',
        },
      },
      aggregation: {
        type: 'string',
        description: 'Type of aggregation to perform on the transactions',
        enum: [
          'list',
          'sum',
          'count',
          'group_by_category',
          'group_by_merchant',
          'top_expenses',
          'top_income',
          'monthly_trend',
        ],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50, max: 500)',
      },
    },
    required: ['aggregation'],
  },
} as const;

/**
 * Tool definition for getting category summary with visualization
 */
export const GET_CATEGORY_SUMMARY_TOOL = {
  name: 'get_category_summary',
  description: `Get a visual summary of spending/income BY CATEGORY with charts or tables.
USE THIS TOOL when users ask about:
- "top spending categories" or "top 5 categories"
- "category breakdown" or "spending by category"
- "where does my money go?" or "where did I spend the most?"
- Any query focused on CATEGORIES rather than individual transactions

DO NOT USE THIS TOOL for queries about specific transactions or expenses (use query_transactions instead).

Returns structured data that will be rendered as interactive charts (pie, bar) or detailed tables.
IMPORTANT: Choose the appropriate chartType based on the data:
- Use 'pie' for few categories (2-6) to show proportions
- Use 'bar' for many categories (7+) to compare values
- Use 'table' when users want detailed numbers or all data points`,
  input_schema: {
    type: 'object',
    properties: {
      dateRange: {
        type: 'object',
        description: 'Filter transactions by date range (ISO 8601 format)',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date in ISO format (e.g., "2024-01-01T00:00:00.000Z")',
          },
          endDate: {
            type: 'string',
            description: 'End date in ISO format (e.g., "2024-12-31T23:59:59.999Z")',
          },
        },
      },
      transactionType: {
        type: 'string',
        description: 'Filter by transaction type',
        enum: ['income', 'expense', 'transfer', 'all'],
      },
      chartType: {
        type: 'string',
        description:
          'Type of visualization to use. Choose pie for few categories, bar for many, table for detailed view.',
        enum: ['pie', 'bar', 'table'],
      },
    },
    required: ['chartType'],
  },
} as const;

/**
 * Tool definition for listing bank account balances
 */
export const LIST_BANK_ACCOUNTS_TOOL = {
  name: 'list_bank_accounts',
  description: `List all bank accounts with their current balances.
USE THIS TOOL when users ask about:
- "What are my account balances?"
- "How much money do I have?"
- "Show me my bank accounts"
- "What's in my checking account?"
- "What's my total balance?"
- Any query about bank account balances or account information`,
  input_schema: {
    type: 'object',
    properties: {
      includeDeleted: {
        type: 'boolean',
        description: 'Include deleted accounts (default: false)',
      },
    },
  },
} as const;

/**
 * Input type for list categories tool
 */
export interface ListCategoriesInput {
  searchTerm?: string;
}

/**
 * Input type for list merchants tool
 */
export interface ListMerchantsInput {
  searchTerm?: string;
  limit?: number;
}

/**
 * Input type for the transaction query tool
 */
export interface QueryTransactionsInput {
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  amountRange?: {
    min?: number;
    max?: number;
  };
  accountIds?: string[];
  categoryIds?: string[];
  merchantIds?: string[];
  aggregation:
    | 'list'
    | 'sum'
    | 'count'
    | 'group_by_category'
    | 'group_by_merchant'
    | 'top_expenses'
    | 'top_income'
    | 'monthly_trend';
  limit?: number;
}

/**
 * Input type for the category summary tool
 */
export interface GetCategorySummaryInput {
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  transactionType?: 'income' | 'expense' | 'transfer' | 'all';
  chartType: 'pie' | 'bar' | 'table';
}

/**
 * Input type for the list bank accounts tool
 */
export interface ListBankAccountsInput {
  includeDeleted?: boolean;
}

/**
 * Execute the list categories tool
 */
export async function executeListCategories(
  ctx: ActionCtx,
  userId: string,
  input: ListCategoriesInput,
): Promise<string> {
  try {
    // Fetch all categories for the user (including system categories)
    const categories = await ctx.runQuery(internal.chatbot.tools.getAllCategories, {
      userId,
    });

    if (categories.length === 0) {
      return 'No categories found. You may need to set up your categories first.';
    }

    // Filter by search term if provided
    let filteredCategories = categories;
    if (input.searchTerm) {
      const searchLower = input.searchTerm.toLowerCase();
      filteredCategories = categories.filter(
        (c) =>
          c.categoryName.toLowerCase().includes(searchLower) ||
          c.groupName?.toLowerCase().includes(searchLower),
      );
    }

    if (filteredCategories.length === 0) {
      return `No categories found matching "${input.searchTerm}". Try searching for a different term.`;
    }

    // Format the response
    const formatted = filteredCategories.map((c) => {
      const groupPrefix = c.groupName ? `${c.groupName} > ` : '';
      return `- ID: ${c.categoryId} | Name: ${groupPrefix}${c.categoryName} | Type: ${c.type}`;
    });

    return `Found ${filteredCategories.length} categor${filteredCategories.length === 1 ? 'y' : 'ies'}:\n\n${formatted.join('\n')}`;
  } catch (error) {
    console.error('Error listing categories:', error);
    return `Error listing categories: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Execute the list merchants tool
 */
export async function executeListMerchants(
  ctx: ActionCtx,
  userId: string,
  input: ListMerchantsInput,
): Promise<string> {
  try {
    // Fetch all merchants for the user
    const merchants = await ctx.runQuery(internal.chatbot.tools.getAllMerchants, {
      userId,
    });

    if (merchants.length === 0) {
      return 'No merchants found in your transactions.';
    }

    // Filter by search term if provided
    let filteredMerchants = merchants;
    if (input.searchTerm) {
      const searchLower = input.searchTerm.toLowerCase();
      filteredMerchants = merchants.filter((m) => m.name.toLowerCase().includes(searchLower));
    }

    if (filteredMerchants.length === 0) {
      return `No merchants found matching "${input.searchTerm}". Try searching for a different term.`;
    }

    // Apply limit
    const limit = Math.min(input.limit || 50, 100);
    const limitedMerchants = filteredMerchants.slice(0, limit);

    // Format the response
    const formatted = limitedMerchants.map((m) => {
      return `- ID: ${m.merchantId} | Name: ${m.name} | Transactions: ${m.transactionCount}`;
    });

    const totalCount = filteredMerchants.length;
    const showingText = totalCount > limit ? ` (showing first ${limit} of ${totalCount})` : '';

    return `Found ${totalCount} merchant${totalCount === 1 ? '' : 's'}${showingText}:\n\n${formatted.join('\n')}`;
  } catch (error) {
    console.error('Error listing merchants:', error);
    return `Error listing merchants: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Execute the category summary tool
 */
export async function executeGetCategorySummary(
  ctx: ActionCtx,
  userId: string,
  input: GetCategorySummaryInput,
): Promise<string> {
  try {
    // Fetch all transactions for the user
    const allTransactions = await ctx.runQuery(internal.chatbot.tools.getAllTransactions, {
      userId,
    });

    // Apply date range filter
    let filteredTransactions = allTransactions;
    if (input.dateRange?.startDate) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.date >= input.dateRange!.startDate!,
      );
    }
    if (input.dateRange?.endDate) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.date <= input.dateRange!.endDate!,
      );
    }

    // Apply transaction type filter
    if (input.transactionType && input.transactionType !== 'all') {
      if (input.transactionType === 'expense') {
        filteredTransactions = filteredTransactions.filter((t) => Number(t.amount) < 0);
      } else if (input.transactionType === 'income') {
        filteredTransactions = filteredTransactions.filter((t) => Number(t.amount) > 0);
      } else if (input.transactionType === 'transfer') {
        // Transfers are typically amount 0 or have a specific flag
        filteredTransactions = filteredTransactions.filter((t) => Number(t.amount) === 0);
      }
    }

    // Group by category
    const categoryMap = new Map<
      string,
      { categoryId: string; transactions: number; total: number }
    >();

    for (const t of filteredTransactions) {
      if (!t.categoryId) continue;

      const amount = Math.abs(Number(t.amount));
      if (!categoryMap.has(t.categoryId)) {
        categoryMap.set(t.categoryId, { categoryId: t.categoryId, transactions: 0, total: 0 });
      }

      const entry = categoryMap.get(t.categoryId)!;
      entry.transactions++;
      entry.total += amount;
    }

    if (categoryMap.size === 0) {
      return 'No categorized transactions found for the specified filters.';
    }

    // Format text summary
    const grandTotal = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.total, 0);
    const sorted = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

    // Limit to top 10 categories for both display and chart
    const topCategories = sorted.slice(0, 10);
    const categoryIds = topCategories.map((entry) => entry.categoryId);

    const summaryLines = await Promise.all(
      topCategories.map(async (entry) => {
        const categoryName = await getCategoryNameForAction(ctx, entry.categoryId);
        const percentage = ((entry.total / grandTotal) * 100).toFixed(1);
        const average = entry.total / entry.transactions;
        return `- ${categoryName}: ${formatCurrency(entry.total)} (${entry.transactions} transactions, ${percentage}%, avg ${formatCurrency(average)})`;
      }),
    );

    const dateRangeText = input.dateRange
      ? ` from ${input.dateRange.startDate ? formatDate(input.dateRange.startDate) : 'beginning'} to ${input.dateRange.endDate ? formatDate(input.dateRange.endDate) : 'now'}`
      : '';
    const typeText =
      input.transactionType && input.transactionType !== 'all' ? ` (${input.transactionType})` : '';

    const summary = `Category Breakdown${dateRangeText}${typeText}:\n\n${summaryLines.join('\n')}\n\nTotal: ${formatCurrency(grandTotal)}`;

    // Add RENDER command for visualization
    const renderData = {
      categoryIds,
      chartType: input.chartType,
      startDate: input.dateRange?.startDate,
      endDate: input.dateRange?.endDate,
      transactionType: input.transactionType || 'all',
    };

    const command = `[RENDER:category-chart:${JSON.stringify(renderData)}]`;
    return `${summary}\n\n${command}`;
  } catch (error) {
    console.error('Error getting category summary:', error);
    return `Error getting category summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Execute the list bank accounts tool
 */
export async function executeListBankAccounts(
  ctx: ActionCtx,
  userId: string,
  input: ListBankAccountsInput,
): Promise<string> {
  try {
    const accounts = await ctx.runQuery(internal.chatbot.tools.getAllBankAccounts, {
      userId,
      includeDeleted: input.includeDeleted || false,
    });

    if (accounts.length === 0) {
      return 'No bank accounts found. You may need to link your bank accounts first.';
    }

    // Calculate total across all accounts (excluding credit cards)
    const totalBalance = accounts.reduce((sum, acc) => {
      // For credit cards, negative balance means you owe money
      // For other accounts, use currentBalance as is
      return sum + (acc.currentBalance || 0);
    }, 0);

    // Validate account IDs for table rendering
    const accountIds = accounts
      .map((acc) => acc._id)
      .filter((id) => {
        // Validate that the ID exists and is a string
        if (!id || typeof id !== 'string') {
          return false;
        }
        // Additional validation: Convex IDs are typically 28-32 characters and alphanumeric
        return /^[a-z0-9]{28,32}$/i.test(id);
      });

    // If we can render a table, just return a brief intro with the table command
    if (accountIds.length > 0) {
      const command = `[RENDER:bank-account-table:${JSON.stringify({ accountIds })}]`;
      const accountCount = accounts.length;
      const totalFormatted = formatCurrency(totalBalance);
      return `Here are your ${accountCount} bank account${accountCount === 1 ? '' : 's'} with a total balance of ${totalFormatted}:\n\n${command}`;
    }

    // Fallback to text summary if table rendering fails
    const formatted = accounts.map((acc) => {
      const balance = formatCurrency(acc.currentBalance || 0);
      const institution = acc.institutionName || 'Unknown Bank';
      const type = acc.accountType.replace(/_/g, ' ');
      const mask = acc.accountNumberMask ? ` (...${acc.accountNumberMask})` : '';

      return `- ${acc.name}${mask} (${type}, ${institution}): ${balance}`;
    });

    const totalFormatted = formatCurrency(totalBalance);
    return `Your Bank Accounts:\n\n${formatted.join('\n')}\n\nTotal Balance: ${totalFormatted}`;
  } catch (error) {
    console.error('Error listing bank accounts:', error);
    return `Error listing bank accounts: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Execute the transaction query tool
 */
export async function executeQueryTransactions(
  ctx: ActionCtx,
  userId: string,
  input: QueryTransactionsInput,
): Promise<string> {
  try {
    // Fetch all transactions for the user
    const allTransactions = await ctx.runQuery(internal.chatbot.tools.getAllTransactions, {
      userId,
    });

    // Apply filters in memory
    let filteredTransactions = allTransactions;

    // Date range filter
    if (input.dateRange?.startDate) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.date >= input.dateRange!.startDate!,
      );
    }
    if (input.dateRange?.endDate) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.date <= input.dateRange!.endDate!,
      );
    }

    // Amount range filter
    if (input.amountRange?.min !== undefined) {
      filteredTransactions = filteredTransactions.filter(
        (t) => Number(t.amount) >= input.amountRange!.min!,
      );
    }
    if (input.amountRange?.max !== undefined) {
      filteredTransactions = filteredTransactions.filter(
        (t) => Number(t.amount) <= input.amountRange!.max!,
      );
    }

    // Account filter
    if (input.accountIds && input.accountIds.length > 0) {
      filteredTransactions = filteredTransactions.filter((t) =>
        input.accountIds!.includes(t.bankAccountId),
      );
    }

    // Category filter
    if (input.categoryIds && input.categoryIds.length > 0) {
      filteredTransactions = filteredTransactions.filter((t) =>
        t.categoryId ? input.categoryIds!.includes(t.categoryId) : false,
      );
    }

    // Merchant filter
    if (input.merchantIds && input.merchantIds.length > 0) {
      filteredTransactions = filteredTransactions.filter((t) =>
        t.merchantId ? input.merchantIds!.includes(t.merchantId) : false,
      );
    }

    // Execute aggregation
    const limit = Math.min(input.limit || 50, 500);

    switch (input.aggregation) {
      case 'list':
        return await formatTransactionList(ctx, filteredTransactions, limit);

      case 'sum':
        return formatSum(filteredTransactions);

      case 'count':
        return formatCount(filteredTransactions);

      case 'group_by_category':
        return await formatGroupByCategory(ctx, filteredTransactions);

      case 'group_by_merchant':
        return await formatGroupByMerchant(ctx, filteredTransactions);

      case 'top_expenses':
        return await formatTopExpenses(ctx, filteredTransactions, limit);

      case 'top_income':
        return await formatTopIncome(ctx, filteredTransactions, limit);

      case 'monthly_trend':
        return formatMonthlyTrend(filteredTransactions);

      default:
        return 'Invalid aggregation type specified.';
    }
  } catch (error) {
    console.error('Error executing transaction query:', error);
    return `Error querying transactions: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get merchant name from merchant ID (action-compatible)
 */
async function getMerchantNameForAction(ctx: ActionCtx, merchantId: string): Promise<string> {
  try {
    const merchant = await ctx.runQuery(internal.chatbot.tools.getMerchantById, {
      merchantId,
    });

    if (!merchant) return 'Unknown';

    if (merchant.name) {
      return merchant.name;
    }

    if (merchant.globalMerchantId) {
      const globalMerchant = await ctx.runQuery(internal.chatbot.tools.getGlobalMerchantById, {
        globalMerchantId: merchant.globalMerchantId,
      });
      if (globalMerchant?.name) {
        return globalMerchant.name;
      }
    }

    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Get category name from category ID (action-compatible)
 */
async function getCategoryNameForAction(ctx: ActionCtx, categoryId: string): Promise<string> {
  try {
    const category = await ctx.runQuery(internal.chatbot.tools.getCategoryById, {
      categoryId,
    });

    if (!category) return 'Unknown';

    if (category.categoryGroupId) {
      const group = await ctx.runQuery(internal.chatbot.tools.getCategoryGroupById, {
        categoryGroupId: category.categoryGroupId,
      });
      if (group) {
        return `${group.name} > ${category.name}`;
      }
    }

    return category.name;
  } catch {
    return 'Unknown';
  }
}

/**
 * Format a list of transactions
 */
async function formatTransactionList(
  ctx: ActionCtx,
  transactions: any[],
  limit: number,
): Promise<string> {
  const sortedTransactions = transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  if (sortedTransactions.length === 0) {
    return 'No transactions found matching the criteria.';
  }

  const formattedList = await Promise.all(
    sortedTransactions.map(async (t) => {
      const amount = formatCurrency(t.amount);
      const date = formatDate(t.date);
      const merchant = t.merchantId ? await getMerchantNameForAction(ctx, t.merchantId) : 'Unknown';
      const category = t.categoryId
        ? await getCategoryNameForAction(ctx, t.categoryId)
        : 'Uncategorized';

      return `- ${date}: ${merchant} | ${amount} | ${category}`;
    }),
  );

  const summary = `Found ${transactions.length} transaction(s)${transactions.length > limit ? ` (showing first ${limit})` : ''}:\n\n${formattedList.join('\n')}`;

  // Add command to render transaction table if 3 or more transactions
  if (sortedTransactions.length >= 3) {
    const transactionIds = sortedTransactions
      .map((t) => t._id)
      .filter((id) => {
        // Validate that the ID exists and is a string
        if (!id || typeof id !== 'string') {
          return false;
        }
        // Additional validation: Convex IDs are typically 28-32 characters and alphanumeric
        return /^[a-z0-9]{28,32}$/i.test(id);
      });

    if (transactionIds.length > 0) {
      const command = `[RENDER:transaction-table:${JSON.stringify({ transactionIds })}]`;
      return `${summary}\n\n${command}`;
    }
  }

  return summary;
}

/**
 * Format sum aggregation
 */
function formatSum(transactions: any[]): string {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (amount > 0) {
      totalIncome += amount;
    } else {
      totalExpenses += Math.abs(amount);
    }
  }

  const netAmount = totalIncome - totalExpenses;

  return `Transaction Summary:
- Total Income: ${formatCurrency(totalIncome)}
- Total Expenses: ${formatCurrency(totalExpenses)}
- Net Amount: ${formatCurrency(netAmount)}
- Transaction Count: ${transactions.length}`;
}

/**
 * Format count aggregation
 */
function formatCount(transactions: any[]): string {
  const incomeCount = transactions.filter((t) => Number(t.amount) > 0).length;
  const expenseCount = transactions.filter((t) => Number(t.amount) < 0).length;

  return `Transaction Count: ${transactions.length} total (${incomeCount} income, ${expenseCount} expenses)`;
}

/**
 * Format group by category
 */
async function formatGroupByCategory(ctx: ActionCtx, transactions: any[]): Promise<string> {
  const categoryMap = new Map<string, { count: number; total: number; categoryId: string }>();

  for (const t of transactions) {
    if (!t.categoryId) continue;

    const key = t.categoryId;
    const amount = Math.abs(Number(t.amount));

    if (!categoryMap.has(key)) {
      categoryMap.set(key, { count: 0, total: 0, categoryId: key });
    }

    const entry = categoryMap.get(key)!;
    entry.count++;
    entry.total += amount;
  }

  if (categoryMap.size === 0) {
    return 'No categorized transactions found.';
  }

  const grandTotal = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.total, 0);

  const sorted = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

  const formatted = await Promise.all(
    sorted.map(async (entry) => {
      const categoryName = await getCategoryNameForAction(ctx, entry.categoryId);
      const percentage = ((entry.total / grandTotal) * 100).toFixed(1);
      return `- ${categoryName}: ${formatCurrency(entry.total)} (${entry.count} transactions, ${percentage}%)`;
    }),
  );

  return `Spending by Category:\n\n${formatted.join('\n')}\n\nTotal: ${formatCurrency(grandTotal)}`;
}

/**
 * Format group by merchant
 */
async function formatGroupByMerchant(ctx: ActionCtx, transactions: any[]): Promise<string> {
  const merchantMap = new Map<string, { count: number; total: number; merchantId: string }>();

  for (const t of transactions) {
    if (!t.merchantId) continue;

    const key = t.merchantId;
    const amount = Math.abs(Number(t.amount));

    if (!merchantMap.has(key)) {
      merchantMap.set(key, { count: 0, total: 0, merchantId: key });
    }

    const entry = merchantMap.get(key)!;
    entry.count++;
    entry.total += amount;
  }

  if (merchantMap.size === 0) {
    return 'No transactions with merchants found.';
  }

  const sorted = Array.from(merchantMap.values()).sort((a, b) => b.total - a.total);

  const formatted = await Promise.all(
    sorted.slice(0, 20).map(async (entry) => {
      const merchantName = await getMerchantNameForAction(ctx, entry.merchantId);
      return `- ${merchantName}: ${formatCurrency(entry.total)} (${entry.count} transactions)`;
    }),
  );

  return `Spending by Merchant (Top 20):\n\n${formatted.join('\n')}`;
}

/**
 * Format top expenses
 */
async function formatTopExpenses(
  ctx: ActionCtx,
  transactions: any[],
  limit: number,
): Promise<string> {
  const expenses = transactions
    .filter((t) => Number(t.amount) < 0)
    .sort((a, b) => Number(a.amount) - Number(b.amount))
    .slice(0, limit);

  if (expenses.length === 0) {
    return 'No expenses found.';
  }

  const formatted = await Promise.all(
    expenses.map(async (t) => {
      const amount = formatCurrency(Math.abs(Number(t.amount)));
      const date = formatDate(t.date);
      const merchant = t.merchantId ? await getMerchantNameForAction(ctx, t.merchantId) : 'Unknown';

      return `- ${date}: ${merchant} | ${amount}`;
    }),
  );

  const summary = `Top ${expenses.length} Expense(s):\n\n${formatted.join('\n')}`;

  // Add command to render transaction table if 3 or more transactions
  if (expenses.length >= 3) {
    const transactionIds = expenses
      .map((t) => t._id)
      .filter((id) => {
        // Validate that the ID exists and is a string
        if (!id || typeof id !== 'string') {
          return false;
        }
        return /^[a-z0-9]{28,32}$/i.test(id);
      });

    if (transactionIds.length > 0) {
      const command = `[RENDER:transaction-table:${JSON.stringify({ transactionIds })}]`;
      return `${summary}\n\n${command}`;
    }
  }

  return summary;
}

/**
 * Format top income
 */
async function formatTopIncome(
  ctx: ActionCtx,
  transactions: any[],
  limit: number,
): Promise<string> {
  const income = transactions
    .filter((t) => Number(t.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, limit);

  if (income.length === 0) {
    return 'No income found.';
  }

  const formatted = await Promise.all(
    income.map(async (t) => {
      const amount = formatCurrency(Number(t.amount));
      const date = formatDate(t.date);
      const merchant = t.merchantId ? await getMerchantNameForAction(ctx, t.merchantId) : 'Unknown';

      return `- ${date}: ${merchant} | ${amount}`;
    }),
  );

  const summary = `Top ${income.length} Income Transaction(s):\n\n${formatted.join('\n')}`;

  // Add command to render transaction table if 3 or more transactions
  if (income.length >= 3) {
    const transactionIds = income
      .map((t) => t._id)
      .filter((id) => {
        // Validate that the ID exists and is a string
        if (!id || typeof id !== 'string') {
          return false;
        }
        return /^[a-z0-9]{28,32}$/i.test(id);
      });

    if (transactionIds.length > 0) {
      const command = `[RENDER:transaction-table:${JSON.stringify({ transactionIds })}]`;
      return `${summary}\n\n${command}`;
    }
  }

  return summary;
}

/**
 * Format monthly trend
 */
function formatMonthlyTrend(transactions: any[]): string {
  const monthlyData = new Map<string, { income: number; expenses: number; count: number }>();

  for (const t of transactions) {
    const date = new Date(t.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const amount = Number(t.amount);

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { income: 0, expenses: 0, count: 0 });
    }

    const entry = monthlyData.get(monthKey)!;
    entry.count++;

    if (amount > 0) {
      entry.income += amount;
    } else {
      entry.expenses += Math.abs(amount);
    }
  }

  const sorted = Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const formatted = sorted.map(([month, data]) => {
    const net = data.income - data.expenses;
    return `- ${month}: Income ${formatCurrency(data.income)} | Expenses ${formatCurrency(data.expenses)} | Net ${formatCurrency(net)} (${data.count} transactions)`;
  });

  return `Monthly Spending Trend:\n\n${formatted.join('\n')}`;
}

/**
 * Internal query to get all transactions for a user
 */
export const getAllTransactions = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('transaction')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect();
  },
});

/**
 * Internal query to get a merchant by ID
 */
export const getMerchantById = internalQuery({
  args: {
    merchantId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.merchantId as Id<'merchant'>);
  },
});

/**
 * Internal query to get a global merchant by ID
 */
export const getGlobalMerchantById = internalQuery({
  args: {
    globalMerchantId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.globalMerchantId as Id<'globalMerchant'>);
  },
});

/**
 * Internal query to get a category by ID
 */
export const getCategoryById = internalQuery({
  args: {
    categoryId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId as Id<'category'>);
  },
});

/**
 * Internal query to get a category group by ID
 */
export const getCategoryGroupById = internalQuery({
  args: {
    categoryGroupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryGroupId as Id<'categoryGroup'>);
  },
});

/**
 * Internal query to get all categories for a user (including system categories)
 */
export const getAllCategories = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user categories
    const userCategories = await ctx.db
      .query('category')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => q.neq(q.field('isDeleted'), true))
      .collect();

    // Get system categories
    const systemCategories = await ctx.db
      .query('category')
      .withIndex('by_isSystemCategory', (q) => q.eq('isSystemCategory', true))
      .filter((q) => q.neq(q.field('isDeleted'), true))
      .collect();

    // Combine and format categories
    const allCategories = [...userCategories, ...systemCategories];

    // Fetch category group names
    const categoriesWithGroups = await Promise.all(
      allCategories.map(async (category) => {
        let groupName: string | null = null;
        let type: string = 'expense'; // default

        if (category.categoryGroupId) {
          const group = await ctx.db.get(category.categoryGroupId);
          if (group) {
            groupName = group.name;
            type = group.type;
          }
        }

        return {
          categoryId: category._id,
          categoryName: category.name,
          groupName,
          type,
          isSystem: category.isSystemCategory || false,
        };
      }),
    );

    // Sort by group name, then category name
    return categoriesWithGroups.sort((a, b) => {
      const groupCompare = (a.groupName || '').localeCompare(b.groupName || '');
      if (groupCompare !== 0) return groupCompare;
      return a.categoryName.localeCompare(b.categoryName);
    });
  },
});

/**
 * Internal query to get all merchants for a user with transaction counts
 */
export const getAllMerchants = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user merchants
    const merchants = await ctx.db
      .query('merchant')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => q.neq(q.field('isDeleted'), true))
      .collect();

    // Get transaction counts for each merchant
    const merchantsWithCounts = await Promise.all(
      merchants.map(async (merchant) => {
        // Count transactions for this merchant
        const transactions = await ctx.db
          .query('transaction')
          .withIndex('by_userId_merchantId', (q) =>
            q.eq('userId', args.userId).eq('merchantId', merchant._id),
          )
          .filter((q) => q.eq(q.field('isDeleted'), false))
          .collect();

        // Get merchant name (from custom name or global merchant)
        let name = merchant.name || 'Unknown';
        if (!merchant.name && merchant.globalMerchantId) {
          const globalMerchant = await ctx.db.get(merchant.globalMerchantId);
          if (globalMerchant?.name) {
            name = globalMerchant.name;
          }
        }

        return {
          merchantId: merchant._id,
          name,
          transactionCount: transactions.length,
        };
      }),
    );

    // Filter out merchants with no transactions and sort by transaction count
    return merchantsWithCounts
      .filter((m) => m.transactionCount > 0)
      .sort((a, b) => b.transactionCount - a.transactionCount);
  },
});

/**
 * Internal query to get all bank accounts for a user with institution data
 */
export const getAllBankAccounts = internalQuery({
  args: {
    userId: v.string(),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get user bank accounts
    const accounts = await ctx.db
      .query('bankAccount')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => {
        return args.includeDeleted ? true : q.eq(q.field('isDeleted'), false);
      })
      .collect();

    // Enrich with institution data
    const enriched = await Promise.all(
      accounts.map(async (account) => {
        const bankLink = account.bankLinkId ? await ctx.db.get(account.bankLinkId) : null;
        const institution = bankLink?.globalInstitutionId
          ? await ctx.db.get(bankLink.globalInstitutionId)
          : null;

        return {
          _id: account._id,
          name: account.name,
          accountType: account.accountType,
          currentBalance: account.currentBalance,
          availableBalance: account.availableBalance,
          accountNumberMask: account.accountNumberMask,
          institutionName: institution?.name || null,
          institutionLogoUrl: institution?.logoUrl || null,
        };
      }),
    );

    return enriched;
  },
});
