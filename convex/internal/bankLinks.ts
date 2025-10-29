import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Creates a new bank link record representing a user's connection to a bank.
 *
 * @param accessToken - The Plaid access token (SENSITIVE - required for all future API calls)
 * @param globalInstitutionId - Reference to the global institution record
 * @param itemId - Plaid's item ID
 * @param itemStatus - The status of the bank connection
 * @param userId - The user ID from authentication
 * @param provider - The bank data provider ('plaid' or 'saltedge')
 * @returns The ID of the created bank link
 */
export const createBankLink = internalMutation({
  args: {
    accessToken: v.string(),
    globalInstitutionId: v.optional(v.id('globalInstitution')),
    itemId: v.string(),
    itemStatus: v.union(
      v.literal('Healthy'),
      v.literal('Error'),
      v.literal('Pending'),
      v.literal('Disconnected'),
    ),
    userId: v.string(),
    provider: v.optional(v.union(v.literal('plaid'), v.literal('saltedge'))),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const bankLinkId = await ctx.db.insert('bankLink', {
      accessToken: args.accessToken,
      globalInstitutionId: args.globalInstitutionId,
      itemId: args.itemId,
      itemStatus: args.itemStatus,
      userId: args.userId,
      provider: args.provider ?? 'plaid',
      updatedAt: now,
      createdAt: now,
      hasCompletedFirstSync: false,
      isDeleted: false,
    });

    return bankLinkId;
  },
});
