import { internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';

/**
 * Creates a new bank account record for an individual account from Plaid.
 *
 * @param accountNumberMask - The last 4 digits of the account number (e.g., "1234")
 * @param accountType - The type of account (e.g., "checking", "savings", "credit_card")
 * @param availableBalance - Available balance in cents
 * @param currentBalance - Current balance in cents
 * @param initialBalance - Balance at link time in cents (never changes)
 * @param bankLinkId - Reference to the parent bank link
 * @param globalInstitutionId - Reference to the global institution
 * @param name - Account name from Plaid
 * @param officialName - Official account name from Plaid
 * @param plaidAccountId - Plaid's account ID
 * @param userId - The user ID from authentication
 * @returns The ID of the created bank account
 */
export const createBankAccount = internalMutation({
  args: {
    accountNumberMask: v.optional(v.string()),
    accountType: v.string(),
    availableBalance: v.optional(v.number()),
    currentBalance: v.optional(v.number()),
    initialBalance: v.optional(v.number()),
    bankLinkId: v.id('bankLink'),
    globalInstitutionId: v.optional(v.id('globalInstitution')),
    name: v.string(),
    officialName: v.optional(v.string()),
    plaidAccountId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const bankAccountId = await ctx.db.insert('bankAccount', {
      accountNumberMask: args.accountNumberMask,
      accountType: args.accountType,
      availableBalance: args.availableBalance,
      currentBalance: args.currentBalance,
      initialBalance: args.initialBalance,
      bankLinkId: args.bankLinkId,
      globalInstitutionId: args.globalInstitutionId,
      name: args.name,
      officialName: args.officialName,
      plaidAccountId: args.plaidAccountId,
      userId: args.userId,
      updatedAt: now,
      isDeleted: false,
      createdAt: now,
      transactionsStatus: 'pending', // Initial status before transaction generation
    });

    // Schedule dummy transaction generation after 5 seconds
    console.log(`Scheduling transaction generation for bank account ${bankAccountId}`);
    await ctx.scheduler.runAfter(
      5000, // 5 seconds
      internal.internal.generateDummyTransactions.generateDummyTransactions,
      {
        bankAccountId,
        userId: args.userId,
      },
    );

    return bankAccountId;
  },
});
