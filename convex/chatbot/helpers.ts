import { QueryCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Format currency amount from cents to dollars with proper formatting
 */
export function formatCurrency(amountInCents: bigint | number): string {
  const amount = typeof amountInCents === 'bigint' ? Number(amountInCents) : amountInCents;
  const dollars = amount / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

/**
 * Format date string to human-readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Get category name from category ID
 */
export async function getCategoryName(ctx: QueryCtx, categoryId: Id<'category'>): Promise<string> {
  const category = await ctx.db.get(categoryId);
  if (!category) return 'Unknown';

  // If category has a group, get the group name too
  if (category.categoryGroupId) {
    const group = await ctx.db.get(category.categoryGroupId);
    if (group) {
      return `${group.name} > ${category.name}`;
    }
  }

  return category.name;
}

/**
 * Get merchant name from merchant ID
 */
export async function getMerchantName(ctx: QueryCtx, merchantId: Id<'merchant'>): Promise<string> {
  const merchant = await ctx.db.get(merchantId);
  if (!merchant) return 'Unknown';

  // If merchant has a custom name, use that
  if (merchant.name) {
    return merchant.name;
  }

  // Otherwise, get the name from globalMerchant
  if (merchant.globalMerchantId) {
    const globalMerchant = await ctx.db.get(merchant.globalMerchantId);
    if (globalMerchant?.name) {
      return globalMerchant.name;
    }
  }

  return 'Unknown';
}

/**
 * Get bank account name from bank account ID
 */
export async function getBankAccountName(
  ctx: QueryCtx,
  bankAccountId: Id<'bankAccount'>,
): Promise<string> {
  const account = await ctx.db.get(bankAccountId);
  if (!account) return 'Unknown';
  return account.name;
}

/**
 * Parse date range from natural language
 * Returns start and end ISO date strings
 */
export function parseDateRange(rangeStr: string): { start: string; end: string } | null {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  const lowerStr = rangeStr.toLowerCase();

  if (lowerStr.includes('this month')) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (lowerStr.includes('last month')) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (lowerStr.includes('this year')) {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (lowerStr.includes('last year')) {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31);
  } else if (lowerStr.match(/last (\d+) days?/)) {
    const match = lowerStr.match(/last (\d+) days?/);
    const days = match ? parseInt(match[1]) : 30;
    start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    end = now;
  } else {
    return null;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Group transactions by category for summary
 */
export interface CategorySummary {
  categoryName: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

/**
 * Group transactions by merchant for summary
 */
export interface MerchantSummary {
  merchantName: string;
  count: number;
  totalAmount: number;
}
