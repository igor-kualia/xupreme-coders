/**
 * Development-only utility to clear all data
 * DANGEROUS: This will delete ALL data for the ENTIRE project
 */

import { internalMutation } from '../_generated/server';

/**
 * Clears ALL data from the database
 * This should ONLY be used in development environments
 *
 * IMPORTANT: This function is protected to only run on development deployments
 * It checks the Convex deployment URL to ensure it's not production
 *
 * NOTE: This keeps system categories and category groups intact
 */
export const clearAllProjectData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // SAFETY CHECK: Only allow this in development
    const convexUrl = process.env['CONVEX_CLOUD_URL'] || '';
    const isDevelopment =
      convexUrl.includes('hallowed-squirrel-142.convex.cloud') || // Your dev URL
      !convexUrl.includes('rugged-lark-476.convex.cloud'); // NOT your prod URL

    if (!isDevelopment) {
      throw new Error(
        'clearAllUserData can only be run in development environments. ' +
          'Current deployment URL does not match development.',
      );
    }

    console.log(`🧹 Starting complete data cleanup for entire project...`);

    // 1. Delete all transactions
    const transactions = await ctx.db.query('transaction').collect();
    for (const transaction of transactions) {
      await ctx.db.delete(transaction._id);
    }
    console.log(`   ✓ Deleted ${transactions.length} transactions`);

    // 2. Delete all merchants (user-specific)
    const merchants = await ctx.db.query('merchant').collect();
    for (const merchant of merchants) {
      await ctx.db.delete(merchant._id);
    }
    console.log(`   ✓ Deleted ${merchants.length} merchants`);

    // 3. Delete all global merchants
    const globalMerchants = await ctx.db.query('globalMerchant').collect();
    for (const globalMerchant of globalMerchants) {
      await ctx.db.delete(globalMerchant._id);
    }
    console.log(`   ✓ Deleted ${globalMerchants.length} global merchants`);

    // 4. Delete all merchant category mappings
    const merchantCategoryMappings = await ctx.db.query('merchantCategoryMapping').collect();
    for (const mapping of merchantCategoryMappings) {
      await ctx.db.delete(mapping._id);
    }
    console.log(`   ✓ Deleted ${merchantCategoryMappings.length} merchant category mappings`);

    // 5. Delete all bank accounts
    const bankAccounts = await ctx.db.query('bankAccount').collect();
    for (const account of bankAccounts) {
      await ctx.db.delete(account._id);
    }
    console.log(`   ✓ Deleted ${bankAccounts.length} bank accounts`);

    // 6. Delete all bank links
    const bankLinks = await ctx.db.query('bankLink').collect();
    for (const link of bankLinks) {
      await ctx.db.delete(link._id);
    }
    console.log(`   ✓ Deleted ${bankLinks.length} bank links`);

    // 7. Delete all global institutions
    const globalInstitutions = await ctx.db.query('globalInstitution').collect();
    for (const institution of globalInstitutions) {
      await ctx.db.delete(institution._id);
    }
    console.log(`   ✓ Deleted ${globalInstitutions.length} global institutions`);

    // 8. Delete all user-specific categories (keep system categories)
    const userCategories = await ctx.db
      .query('category')
      .filter((q) => q.neq(q.field('isSystemCategory'), true))
      .collect();
    for (const category of userCategories) {
      await ctx.db.delete(category._id);
    }
    console.log(`   ✓ Deleted ${userCategories.length} user categories`);

    // 9. Delete all user-specific category groups (keep system groups)
    const userCategoryGroups = await ctx.db
      .query('categoryGroup')
      .filter((q) => q.neq(q.field('isSystemGroup'), true))
      .collect();
    for (const group of userCategoryGroups) {
      await ctx.db.delete(group._id);
    }
    console.log(`   ✓ Deleted ${userCategoryGroups.length} user category groups`);

    console.log(`✅ Complete data cleanup finished!`);

    return {
      success: true,
      deleted: {
        transactions: transactions.length,
        merchants: merchants.length,
        globalMerchants: globalMerchants.length,
        merchantCategoryMappings: merchantCategoryMappings.length,
        bankAccounts: bankAccounts.length,
        bankLinks: bankLinks.length,
        globalInstitutions: globalInstitutions.length,
        userCategories: userCategories.length,
        userCategoryGroups: userCategoryGroups.length,
      },
    };
  },
});
