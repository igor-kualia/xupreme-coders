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
    createdAt: v.optional(v.string()), // ISO timestamp when account was created
    transactionsStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('generating'),
        v.literal('completed'),
        v.literal('failed'),
      ),
    ), // Status of initial transaction generation
  })
    .index('by_userId', ['userId'])
    .index('by_bankLinkId', ['bankLinkId']),

  // Category group table - top-level grouping for categories
  categoryGroup: defineTable({
    name: v.string(), // Group name (e.g., "Housing", "Transportation")
    type: v.union(v.literal('income'), v.literal('expense'), v.literal('transfer')),
    userId: v.optional(v.string()), // null for system groups
    isSystemGroup: v.optional(v.boolean()), // System-defined groups
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_type', ['userId', 'type'])
    .index('by_isSystemGroup', ['isSystemGroup']),

  // Category table - categories for organizing transactions
  category: defineTable({
    name: v.string(), // Category name
    userId: v.optional(v.string()), // null for system categories
    categoryGroupId: v.optional(v.id('categoryGroup')), // Parent category group
    iconName: v.optional(v.string()), // Icon identifier
    isSystemCategory: v.optional(v.boolean()), // System-defined category
    categoryType: v.optional(
      v.union(
        v.literal('custom'),
        v.literal('owner_investment'),
        v.literal('revenue'),
        v.literal('credit_card_payment'),
        v.literal('transfer'),
      ),
    ),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_categoryGroupId', ['userId', 'categoryGroupId'])
    .index('by_isSystemCategory', ['isSystemCategory']),

  // Global merchant table - shared merchant data across all users
  globalMerchant: defineTable({
    name: v.string(), // Merchant name
    logoUrl: v.optional(v.string()), // Merchant logo URL
    isVerified: v.optional(v.boolean()), // Manually verified merchant
    updatedAt: v.optional(v.string()),
  }).index('by_name', ['name']),

  // Merchant table - user-specific merchant records
  merchant: defineTable({
    globalMerchantId: v.optional(v.id('globalMerchant')), // Reference to global merchant
    name: v.optional(v.string()), // Custom name override
    logoUrl: v.optional(v.union(v.string(), v.null())), // Custom logo
    userId: v.string(), // User ID
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_globalMerchantId', ['userId', 'globalMerchantId'])
    .index('by_userId_name', ['userId', 'name']),

  // Transaction table - core transaction records
  transaction: defineTable({
    amount: v.int64(), // Transaction amount in cents (negative for expenses)
    bankAccountId: v.id('bankAccount'), // Reference to bank account
    categoryId: v.optional(v.id('category')), // Reference to category
    date: v.string(), // Transaction date (ISO string)
    merchantId: v.optional(v.id('merchant')), // Reference to merchant
    userId: v.string(), // User ID from authentication
    notes: v.optional(v.string()), // User notes
    type: v.union(
      v.literal('regular'),
      v.literal('starting_balance'),
      v.literal('balance_adjustment'),
    ),
    source: v.optional(v.union(v.literal('manual'), v.literal('automatic_import'))),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_bankAccountId', ['bankAccountId'])
    .index('by_userId_merchantId', ['userId', 'merchantId'])
    .index('by_userId_categoryId', ['userId', 'categoryId'])
    .index('by_userId_bankAccountId', ['userId', 'bankAccountId'])
    .index('by_userId_date', ['userId', 'date']),
});
