import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Upserts a global institution record.
 * If an institution with the same provider and providerInstitutionId exists, it updates it.
 * Otherwise, it creates a new institution.
 *
 * @param providerInstitutionId - The institution ID from the provider (e.g., Plaid's institution_id)
 * @param provider - The bank data provider ('Plaid' or 'SaltEdge')
 * @param name - The institution name
 * @param logoUrl - Optional URL to the institution logo stored in Convex storage
 * @param primaryColor - Optional primary brand color of the institution
 * @returns The ID of the upserted institution
 */
export const upsertInstitution = internalMutation({
  args: {
    providerInstitutionId: v.string(),
    provider: v.union(v.literal('Plaid'), v.literal('SaltEdge')),
    name: v.string(),
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if institution already exists
    const existing = await ctx.db
      .query('globalInstitution')
      .withIndex('by_provider_providerInstitutionId', (q) =>
        q.eq('provider', args.provider).eq('providerInstitutionId', args.providerInstitutionId)
      )
      .first();

    const updatedAt = new Date().toISOString();

    if (existing) {
      // Update existing institution
      await ctx.db.patch(existing._id, {
        name: args.name,
        logoUrl: args.logoUrl,
        primaryColor: args.primaryColor,
        updatedAt,
      });
      return existing._id;
    } else {
      // Create new institution
      const institutionId = await ctx.db.insert('globalInstitution', {
        providerInstitutionId: args.providerInstitutionId,
        provider: args.provider,
        name: args.name,
        logoUrl: args.logoUrl,
        primaryColor: args.primaryColor,
        isVerified: false,
        updatedAt,
      });
      return institutionId;
    }
  },
});
