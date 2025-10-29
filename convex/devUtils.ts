/**
 * Development utilities
 * These functions should only be used during development
 */

import { mutation } from './_generated/server';
import { internal } from './_generated/api';

/**
 * Clears ALL data for the entire project
 * DANGEROUS: This will delete ALL data including:
 * - All transactions (all users)
 * - All merchants (all users)
 * - All global merchants
 * - All bank accounts (all users)
 * - All bank links (all users)
 * - All global institutions
 * - All user-specific categories
 * - All user-specific category groups
 *
 * System categories and system category groups are preserved.
 *
 * This function is protected to only run in development environments
 * No authentication required - this is a dev-only utility
 */
export const clearAllData = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    message: string;
    deleted: {
      transactions: number;
      merchants: number;
      globalMerchants: number;
      merchantCategoryMappings: number;
      bankAccounts: number;
      bankLinks: number;
      globalInstitutions: number;
      userCategories: number;
      userCategoryGroups: number;
    };
  }> => {
    // Call internal mutation to do the actual deletion
    // The internal mutation will check the environment
    const result: {
      success: boolean;
      deleted: {
        transactions: number;
        merchants: number;
        globalMerchants: number;
        merchantCategoryMappings: number;
        bankAccounts: number;
        bankLinks: number;
        globalInstitutions: number;
        userCategories: number;
        userCategoryGroups: number;
      };
    } = await ctx.runMutation(internal.internal.clearAllData.clearAllProjectData, {});

    return {
      message: 'All project data has been cleared',
      deleted: result.deleted,
    };
  },
});
