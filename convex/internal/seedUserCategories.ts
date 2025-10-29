/**
 * Seeds default categories and category groups for a specific user
 * Creates user-specific copies of the default category structure
 */

import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

interface CategoryGroupSeed {
  name: string;
  type: 'income' | 'expense' | 'transfer';
  categories: Array<{
    name: string;
    iconName?: string;
  }>;
}

const DEFAULT_CATEGORY_GROUPS: CategoryGroupSeed[] = [
  // Income
  {
    name: 'Income',
    type: 'income',
    categories: [
      { name: 'Salary', iconName: 'briefcase' },
      { name: 'Freelance', iconName: 'laptop' },
      { name: 'Investments', iconName: 'trending-up' },
      { name: 'Business Income', iconName: 'building' },
      { name: 'Other Income', iconName: 'plus-circle' },
    ],
  },

  // Expense Groups
  {
    name: 'Housing',
    type: 'expense',
    categories: [
      { name: 'Rent', iconName: 'home' },
      { name: 'Mortgage', iconName: 'home' },
      { name: 'Property Tax', iconName: 'file-text' },
      { name: 'Home Insurance', iconName: 'shield' },
      { name: 'Home Maintenance', iconName: 'tool' },
    ],
  },

  {
    name: 'Transportation',
    type: 'expense',
    categories: [
      { name: 'Gas', iconName: 'fuel' },
      { name: 'Car Payment', iconName: 'car' },
      { name: 'Car Insurance', iconName: 'shield' },
      { name: 'Auto Maintenance', iconName: 'wrench' },
      { name: 'Public Transit', iconName: 'bus' },
      { name: 'Rideshare', iconName: 'navigation' },
      { name: 'Parking', iconName: 'square' },
    ],
  },

  {
    name: 'Food & Dining',
    type: 'expense',
    categories: [
      { name: 'Groceries', iconName: 'shopping-cart' },
      { name: 'Restaurants', iconName: 'utensils' },
      { name: 'Coffee Shops', iconName: 'coffee' },
      { name: 'Fast Food', iconName: 'fast-forward' },
      { name: 'Bars & Alcohol', iconName: 'wine' },
    ],
  },

  {
    name: 'Shopping',
    type: 'expense',
    categories: [
      { name: 'Clothing', iconName: 'shirt' },
      { name: 'Electronics', iconName: 'smartphone' },
      { name: 'Shopping', iconName: 'shopping-bag' },
      { name: 'Books', iconName: 'book' },
      { name: 'Hobbies', iconName: 'heart' },
    ],
  },

  {
    name: 'Entertainment',
    type: 'expense',
    categories: [
      { name: 'Entertainment', iconName: 'tv' },
      { name: 'Movies & Shows', iconName: 'film' },
      { name: 'Music', iconName: 'music' },
      { name: 'Games', iconName: 'gamepad' },
      { name: 'Sports', iconName: 'activity' },
    ],
  },

  {
    name: 'Bills & Utilities',
    type: 'expense',
    categories: [
      { name: 'Utilities', iconName: 'zap' },
      { name: 'Internet & Cable', iconName: 'wifi' },
      { name: 'Phone', iconName: 'phone' },
      { name: 'Subscriptions', iconName: 'repeat' },
      { name: 'Insurance', iconName: 'shield' },
    ],
  },

  {
    name: 'Healthcare',
    type: 'expense',
    categories: [
      { name: 'Doctor', iconName: 'user-plus' },
      { name: 'Pharmacy', iconName: 'package' },
      { name: 'Health Insurance', iconName: 'shield' },
      { name: 'Dental', iconName: 'smile' },
      { name: 'Vision', iconName: 'eye' },
    ],
  },

  {
    name: 'Personal Care',
    type: 'expense',
    categories: [
      { name: 'Hair & Beauty', iconName: 'scissors' },
      { name: 'Gym', iconName: 'activity' },
      { name: 'Personal Care', iconName: 'user' },
      { name: 'Spa & Massage', iconName: 'heart' },
    ],
  },

  {
    name: 'Education',
    type: 'expense',
    categories: [
      { name: 'Tuition', iconName: 'book-open' },
      { name: 'Student Loans', iconName: 'file-text' },
      { name: 'Books & Supplies', iconName: 'book' },
      { name: 'Courses', iconName: 'award' },
    ],
  },

  {
    name: 'Travel',
    type: 'expense',
    categories: [
      { name: 'Flights', iconName: 'plane' },
      { name: 'Hotels', iconName: 'building' },
      { name: 'Vacation', iconName: 'sun' },
      { name: 'Travel', iconName: 'map' },
    ],
  },

  {
    name: 'Pets',
    type: 'expense',
    categories: [
      { name: 'Pet Food', iconName: 'heart' },
      { name: 'Veterinary', iconName: 'plus-square' },
      { name: 'Pet Supplies', iconName: 'shopping-bag' },
    ],
  },

  {
    name: 'Home Improvement',
    type: 'expense',
    categories: [
      { name: 'Home Improvement', iconName: 'hammer' },
      { name: 'Furniture', iconName: 'square' },
      { name: 'Appliances', iconName: 'tv' },
      { name: 'Garden', iconName: 'flower' },
    ],
  },

  {
    name: 'Financial',
    type: 'expense',
    categories: [
      { name: 'Bank Fees', iconName: 'dollar-sign' },
      { name: 'Taxes', iconName: 'file-text' },
      { name: 'Investments', iconName: 'trending-up' },
      { name: 'Loans', iconName: 'credit-card' },
    ],
  },

  {
    name: 'Other',
    type: 'expense',
    categories: [
      { name: 'Gifts & Donations', iconName: 'gift' },
      { name: 'Charity', iconName: 'heart' },
      { name: 'Other', iconName: 'more-horizontal' },
      { name: 'Uncategorized', iconName: 'help-circle' },
    ],
  },

  // Transfer
  {
    name: 'Transfer',
    type: 'transfer',
    categories: [
      { name: 'Credit Card Payment', iconName: 'credit-card' },
      { name: 'Transfer', iconName: 'arrow-right-left' },
      { name: 'Savings Transfer', iconName: 'piggy-bank' },
    ],
  },
];

/**
 * Seeds default categories and category groups for a specific user
 * This creates user-specific copies that can be customized later
 */
export const seedUserCategories = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const now = new Date().toISOString();

    // Check if user already has categories
    const existingGroups = await ctx.db
      .query('categoryGroup')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    if (existingGroups.length > 0) {
      console.log(`User ${userId} already has categories, skipping...`);
      return { message: 'Already seeded', count: existingGroups.length };
    }

    let totalCategories = 0;

    for (const groupSeed of DEFAULT_CATEGORY_GROUPS) {
      // Create category group for this user
      const groupId = await ctx.db.insert('categoryGroup', {
        name: groupSeed.name,
        type: groupSeed.type,
        userId: userId,
        isSystemGroup: false,
        isDeleted: false,
        updatedAt: now,
      });

      // Create categories under this group
      for (const categorySeed of groupSeed.categories) {
        await ctx.db.insert('category', {
          name: categorySeed.name,
          userId: userId,
          categoryGroupId: groupId,
          iconName: categorySeed.iconName,
          isSystemCategory: false,
          isDeleted: false,
          updatedAt: now,
        });
        totalCategories++;
      }
    }

    console.log(
      `Seeded ${DEFAULT_CATEGORY_GROUPS.length} category groups and ${totalCategories} categories for user ${userId}`,
    );

    return {
      message: 'Successfully seeded',
      groups: DEFAULT_CATEGORY_GROUPS.length,
      categories: totalCategories,
    };
  },
});
