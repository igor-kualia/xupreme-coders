import { action } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { CountryCode } from 'plaid';
import { plaidClient } from './plaidClient';

/**
 * Maps Plaid account types to internal account type strings.
 */
function mapPlaidAccountType(type: string | null, subtype: string | null): string {
  if (type === 'depository') {
    if (subtype === 'checking') return 'checking';
    if (subtype === 'savings') return 'savings';
    if (subtype === 'cd') return 'cd';
    if (subtype === 'money market') return 'money_market';
    return 'depository';
  }
  if (type === 'credit') return 'credit_card';
  if (type === 'loan') {
    if (subtype === 'student') return 'student_loan';
    if (subtype === 'mortgage') return 'mortgage';
    if (subtype === 'auto') return 'auto_loan';
    return 'loan';
  }
  if (type === 'investment') return 'investment';
  if (type === 'brokerage') return 'brokerage';
  return 'other';
}

/**
 * Links a new Plaid item after the user completes Plaid Link.
 * This action exchanges the public token for an access token, fetches account details,
 * stores institution information, and creates bank link and account records.
 *
 * @param publicToken - The public token from Plaid Link
 * @param institutionId - The Plaid institution ID
 * @param institutionName - The institution name
 * @param accounts - Array of account metadata from Plaid Link
 * @param userId - The user ID from authentication
 * @returns Object with success status and created bankLinkId
 */
export const linkNewPlaidItem = action({
  args: {
    publicToken: v.string(),
    institutionId: v.string(),
    institutionName: v.string(),
    accounts: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        mask: v.union(v.string(), v.null()),
        type: v.string(),
        subtype: v.union(v.string(), v.null()),
      })
    ),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    bankLinkId: any;
    accounts: Array<{ id: any; name: string; type: string }>;
  }> => {
    console.log('Starting linkNewPlaidItem for user:', args.userId);

    let accessToken: string;
    let itemId: string;
    let plaidAccounts: any[] = [];
    let institutionData: any = null;

    try {
      // Step 1: Exchange public token for access token
      console.log('Exchanging public token for access token...');
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: args.publicToken,
      });

      accessToken = exchangeResponse.data.access_token;
      itemId = exchangeResponse.data.item_id;
      console.log('Token exchange successful. Item ID:', itemId);

      // Step 2: Fetch full account details from Plaid
      console.log('Fetching account details from Plaid...');
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      plaidAccounts = accountsResponse.data.accounts;
      console.log(`Fetched ${plaidAccounts.length} accounts from Plaid`);

      // Step 3: Fetch institution details with logo
      console.log('Fetching institution details...');
      const institutionResponse = await plaidClient.institutionsGetById({
        institution_id: args.institutionId,
        country_codes: [CountryCode.Us, CountryCode.Ca],
        options: { include_optional_metadata: true },
      });

      institutionData = institutionResponse.data.institution;
      console.log('Institution data fetched:', institutionData.name);
    } catch (error) {
      console.error('Error during Plaid API calls:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to link Plaid item: ${error.message}`);
      }
      throw new Error('Failed to link Plaid item: Unknown error');
    }

    // Step 4: Store institution logo if available
    let logoUrl: string | undefined;
    if (institutionData.logo) {
      try {
        console.log('Storing institution logo...');
        // Convert base64 logo to binary
        const base64Data = institutionData.logo.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Buffer.from(base64Data, 'base64');

        // Store in Convex storage
        const storageId = await ctx.storage.store(new Blob([binaryData], { type: 'image/png' }));
        logoUrl = (await ctx.storage.getUrl(storageId)) ?? undefined;
        console.log('Logo stored successfully');
      } catch (error) {
        console.error('Error storing logo:', error);
        // Continue without logo if storage fails
      }
    }

    // Step 5: Upsert global institution
    console.log('Upserting global institution...');
    const globalInstitutionId = await ctx.runMutation(internal.internal.institutions.upsertInstitution, {
      providerInstitutionId: institutionData.institution_id,
      provider: 'Plaid',
      name: institutionData.name,
      logoUrl,
      primaryColor: institutionData.primary_color ?? undefined,
    });
    console.log('Global institution upserted:', globalInstitutionId);

    // Step 6: Create bank link
    console.log('Creating bank link...');
    const bankLinkId = await ctx.runMutation(internal.internal.bankLinks.createBankLink, {
      accessToken,
      globalInstitutionId,
      itemId,
      itemStatus: 'Healthy',
      userId: args.userId,
      provider: 'plaid',
    });
    console.log('Bank link created:', bankLinkId);

    // Step 7: Create bank accounts for each Plaid account
    console.log('Creating bank accounts...');
    const createdAccounts = [];

    for (const plaidAccount of plaidAccounts) {
      try {
        // Determine if this is a debt account (credit cards, loans)
        const isDebtAccount = plaidAccount.type === 'credit' || plaidAccount.type === 'loan';

        // For debt accounts, flip the sign (debt is represented as negative)
        const balanceMultiplier = isDebtAccount ? -1 : 1;

        // Convert dollar amounts to cents and apply multiplier
        const currentBalanceInCents = plaidAccount.balances.current
          ? Math.floor(plaidAccount.balances.current * 100) * balanceMultiplier
          : undefined;

        const availableBalanceInCents = plaidAccount.balances.available
          ? Math.floor(plaidAccount.balances.available * 100) * balanceMultiplier
          : undefined;

        const bankAccountId = await ctx.runMutation(internal.internal.bankAccounts.createBankAccount, {
          accountNumberMask: plaidAccount.mask ?? undefined,
          accountType: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
          availableBalance: availableBalanceInCents,
          currentBalance: currentBalanceInCents,
          initialBalance: currentBalanceInCents,
          bankLinkId,
          globalInstitutionId,
          name: plaidAccount.name,
          officialName: plaidAccount.official_name ?? undefined,
          plaidAccountId: plaidAccount.account_id,
          userId: args.userId,
        });

        createdAccounts.push({
          id: bankAccountId,
          name: plaidAccount.name,
          type: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
        });

        console.log(`Created bank account: ${plaidAccount.name} (${plaidAccount.account_id})`);
      } catch (error) {
        console.error(`Error creating account ${plaidAccount.name}:`, error);
        // Continue with other accounts even if one fails
      }
    }

    console.log(`Successfully linked Plaid item with ${createdAccounts.length} accounts`);

    return {
      success: true,
      bankLinkId,
      accounts: createdAccounts,
    };
  },
});
