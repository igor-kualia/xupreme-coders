import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Get all bank accounts for the authenticated user
 */
export const listBankAccounts = query({
  args: {
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { includeDeleted = false }) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Query bank accounts for this user
    const bankAccounts = await ctx.db
      .query('bankAccount')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => {
        return includeDeleted ? true : q.eq(q.field('isDeleted'), false);
      })
      .collect();

    // Enrich with bank link and institution information
    // Filter out accounts without a bank link since they should always have one
    const enrichedAccountsWithNulls = await Promise.all(
      bankAccounts.map(async (account) => {
        // Bank account must have a bank link
        if (!account.bankLinkId) {
          return null;
        }

        const bankLink = await ctx.db.get(account.bankLinkId);
        if (!bankLink) {
          return null;
        }

        // Get institution details from the bank link
        const institution = bankLink.globalInstitutionId
          ? await ctx.db.get(bankLink.globalInstitutionId)
          : null;

        // Build the response object with flattened structure
        return {
          _id: account._id,
          name: account.name,
          accountType: account.accountType,
          currentBalance: account.currentBalance,
          availableBalance: account.availableBalance,
          accountNumberMask: account.accountNumberMask,
          officialName: account.officialName,
          plaidAccountId: account.plaidAccountId,
          lastUpdated: account.lastUpdated,
          isDeleted: account.isDeleted,
          deletedAt: account.deletedAt,
          updatedAt: account.updatedAt,
          transactionsStatus: account.transactionsStatus,
          // Bank link properties
          itemStatus: bankLink.itemStatus,
          lastSyncedAt: bankLink.lastSyncedAt,
          // Institution properties
          institutionName: institution?.name,
          institutionLogoUrl: institution?.logoUrl,
          institutionPrimaryColor: institution?.primaryColor,
        };
      }),
    );

    // Filter out null entries (accounts without valid bank links)
    const enrichedAccounts = enrichedAccountsWithNulls.filter(
      (account): account is NonNullable<typeof account> => account !== null,
    );

    return enrichedAccounts;
  },
});
