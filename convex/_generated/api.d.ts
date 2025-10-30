/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bankAccounts from "../bankAccounts.js";
import type * as bankProviders_plaid_createLinkToken from "../bankProviders/plaid/createLinkToken.js";
import type * as bankProviders_plaid_linkNewPlaidItem from "../bankProviders/plaid/linkNewPlaidItem.js";
import type * as bankProviders_plaid_plaidClient from "../bankProviders/plaid/plaidClient.js";
import type * as categorization_categorizeTransactions from "../categorization/categorizeTransactions.js";
import type * as categorization_helpers from "../categorization/helpers.js";
import type * as categorization_llm from "../categorization/llm.js";
import type * as categorization_manualTriggers from "../categorization/manualTriggers.js";
import type * as categoryAggregation from "../categoryAggregation.js";
import type * as chatbot_autoCategorize from "../chatbot/autoCategorize.js";
import type * as chatbot_chatbot from "../chatbot/chatbot.js";
import type * as chatbot_helpers from "../chatbot/helpers.js";
import type * as chatbot_llm from "../chatbot/llm.js";
import type * as chatbot_tools from "../chatbot/tools.js";
import type * as devUtils from "../devUtils.js";
import type * as internal_bankAccounts from "../internal/bankAccounts.js";
import type * as internal_bankLinks from "../internal/bankLinks.js";
import type * as internal_clearAllData from "../internal/clearAllData.js";
import type * as internal_generateDummyTransactions from "../internal/generateDummyTransactions.js";
import type * as internal_institutions from "../internal/institutions.js";
import type * as internal_seedData from "../internal/seedData.js";
import type * as internal_seedUserCategories from "../internal/seedUserCategories.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bankAccounts: typeof bankAccounts;
  "bankProviders/plaid/createLinkToken": typeof bankProviders_plaid_createLinkToken;
  "bankProviders/plaid/linkNewPlaidItem": typeof bankProviders_plaid_linkNewPlaidItem;
  "bankProviders/plaid/plaidClient": typeof bankProviders_plaid_plaidClient;
  "categorization/categorizeTransactions": typeof categorization_categorizeTransactions;
  "categorization/helpers": typeof categorization_helpers;
  "categorization/llm": typeof categorization_llm;
  "categorization/manualTriggers": typeof categorization_manualTriggers;
  categoryAggregation: typeof categoryAggregation;
  "chatbot/autoCategorize": typeof chatbot_autoCategorize;
  "chatbot/chatbot": typeof chatbot_chatbot;
  "chatbot/helpers": typeof chatbot_helpers;
  "chatbot/llm": typeof chatbot_llm;
  "chatbot/tools": typeof chatbot_tools;
  devUtils: typeof devUtils;
  "internal/bankAccounts": typeof internal_bankAccounts;
  "internal/bankLinks": typeof internal_bankLinks;
  "internal/clearAllData": typeof internal_clearAllData;
  "internal/generateDummyTransactions": typeof internal_generateDummyTransactions;
  "internal/institutions": typeof internal_institutions;
  "internal/seedData": typeof internal_seedData;
  "internal/seedUserCategories": typeof internal_seedUserCategories;
  transactions: typeof transactions;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
