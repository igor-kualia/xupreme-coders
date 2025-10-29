import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Global institution table - shared across all users
  globalInstitution: defineTable({
    providerInstitutionId: v.string(), // Plaid's institution ID
    provider: v.union(v.literal('Plaid'), v.literal('SaltEdge')),
    name: v.string(), // Institution name (e.g., "Chase")
    logoUrl: v.optional(v.string()), // Stored in Convex storage
    primaryColor: v.optional(v.string()), // Brand color from Plaid
    isVerified: v.boolean(), // Manual verification flag
    updatedAt: v.string(), // ISO timestamp
  })
    .index('by_providerInstitutionId', ['providerInstitutionId'])
    .index('by_provider_providerInstitutionId', ['provider', 'providerInstitutionId']),

  // Bank link table - represents a user's connection to a bank
  bankLink: defineTable({
    accessToken: v.string(), // Plaid access token (SENSITIVE!)
    globalInstitutionId: v.optional(v.id('globalInstitution')),
    institutionId: v.optional(v.string()), // Legacy field for backward compatibility
    itemId: v.string(), // Plaid item ID
    itemStatus: v.union(
      v.literal('Healthy'),
      v.literal('Error'),
      v.literal('Pending'),
      v.literal('Disconnected'),
    ),
    lastSyncedAt: v.optional(v.string()), // Last transaction sync (future use)
    nextCursor: v.optional(v.string()), // Plaid sync cursor (future use)
    provider: v.optional(v.union(v.literal('plaid'), v.literal('saltedge'))),
    updatedAt: v.optional(v.string()),
    userId: v.string(), // User ID from authentication
    deletedAt: v.optional(v.string()),
    isDeleted: v.optional(v.boolean()),
    hasCompletedFirstSync: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
  }).index('by_userId', ['userId']),

  // Bank account table - individual accounts from Plaid
  // This combines the structure of bankLinkAccount with account data
  bankAccount: defineTable({
    accountNumberMask: v.optional(v.string()), // e.g., "1234"
    accountType: v.string(), // "checking", "savings", "credit_card", etc.
    availableBalance: v.optional(v.number()), // Available balance in cents
    currentBalance: v.optional(v.number()), // Current balance in cents
    initialBalance: v.optional(v.number()), // Balance at link time (never changes)
    bankLinkId: v.id('bankLink'), // Parent bank connection
    globalInstitutionId: v.optional(v.id('globalInstitution')),
    institutionId: v.optional(v.string()), // Legacy field
    lastUpdated: v.optional(v.string()),
    name: v.string(), // Account name from Plaid
    officialName: v.optional(v.string()), // Official account name
    plaidAccountId: v.string(), // Plaid's account ID
    updatedAt: v.string(),
    userId: v.string(), // User ID from authentication
    deletedAt: v.optional(v.string()),
    isDeleted: v.optional(v.boolean()),
  })
    .index('by_userId', ['userId'])
    .index('by_bankLinkId', ['bankLinkId']),
});
