import { QueryCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Normalize merchant names for consistent matching
 * Removes special characters, converts to lowercase, normalizes spaces
 */
export function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Parse category format from LLM response
 * Supports formats: "[GroupName][CategoryName]" or "CategoryName"
 */
export function parseCategoryFromLLM(formattedName: string): {
  categoryName: string;
  groupName: string | null;
} {
  const match = formattedName.match(/^\[([^\]]+)\]\[([^\]]+)\]$/);
  if (match) {
    return {
      groupName: match[1],
      categoryName: match[2],
    };
  }
  // Fallback for standalone category names
  return {
    categoryName: formattedName,
    groupName: null,
  };
}

/**
 * Get merchant name from merchant record
 * Resolves from globalMerchant if available, otherwise uses custom name
 */
export async function getMerchantName(
  ctx: QueryCtx,
  merchantId: Id<'merchant'>,
): Promise<string | null> {
  const merchant = await ctx.db.get(merchantId);
  if (!merchant) return null;

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

  return null;
}

/**
 * Find category by name and optional group name
 * First checks system categories, then user categories
 */
export async function getCategoryByName(
  ctx: QueryCtx,
  userId: string,
  categoryName: string,
  groupName?: string,
): Promise<Id<'category'> | null> {
  // First, try to find the category group if groupName is provided
  let categoryGroupId: Id<'categoryGroup'> | undefined = undefined;

  if (groupName) {
    // Look for system category group first
    const systemGroup = await ctx.db
      .query('categoryGroup')
      .filter((q) =>
        q.and(
          q.eq(q.field('name'), groupName),
          q.eq(q.field('isSystemGroup'), true),
          q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
        ),
      )
      .first();

    if (systemGroup) {
      categoryGroupId = systemGroup._id;
    } else {
      // Look for user-specific group
      const userGroup = await ctx.db
        .query('categoryGroup')
        .filter((q) =>
          q.and(
            q.eq(q.field('name'), groupName),
            q.eq(q.field('userId'), userId),
            q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
          ),
        )
        .first();

      if (userGroup) {
        categoryGroupId = userGroup._id;
      }
    }
  }

  // Now search for the category
  // First try system categories
  const systemCategory = await ctx.db
    .query('category')
    .filter((q) =>
      q.and(
        q.eq(q.field('name'), categoryName),
        q.eq(q.field('isSystemCategory'), true),
        categoryGroupId
          ? q.eq(q.field('categoryGroupId'), categoryGroupId)
          : q.eq(q.field('categoryGroupId'), undefined),
        q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
      ),
    )
    .first();

  if (systemCategory) {
    return systemCategory._id;
  }

  // Then try user categories
  const userCategory = await ctx.db
    .query('category')
    .filter((q) =>
      q.and(
        q.eq(q.field('name'), categoryName),
        q.eq(q.field('userId'), userId),
        categoryGroupId
          ? q.eq(q.field('categoryGroupId'), categoryGroupId)
          : q.eq(q.field('categoryGroupId'), undefined),
        q.or(q.eq(q.field('isDeleted'), undefined), q.eq(q.field('isDeleted'), false)),
      ),
    )
    .first();

  return userCategory?._id ?? null;
}
