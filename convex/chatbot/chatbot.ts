/**
 * Main chatbot actions and queries
 */

import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { action, internalMutation, internalQuery, mutation, query } from '../_generated/server';
import { callLLM, ToolResult } from './llm';
import {
  executeConfirmTransactionUpdate,
  executeGetCategorySummary,
  executeListBankAccounts,
  executeListCategories,
  executeListMerchants,
  executeProposeTransactionUpdate,
  executeQueryTransactions,
  ConfirmTransactionUpdateInput,
  GetCategorySummaryInput,
  ListBankAccountsInput,
  ListCategoriesInput,
  ListMerchantsInput,
  ProposeTransactionUpdateInput,
  QueryTransactionsInput,
  AutoCategorizeByMerchantInput,
} from './tools';
import { executeAutoCategorizeByMerchant } from './autoCategorize';

/**
 * Send a message to the chatbot and get a response
 * This action orchestrates the entire conversation flow:
 * 1. Save user message to DB
 * 2. Fetch conversation history
 * 3. Call LLM with history
 * 4. If LLM requests tools, execute them and call LLM again (loop)
 * 5. Save assistant responses to DB
 * 6. Return final response
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    model: v.optional(v.string()), // OpenRouter model (e.g., "google/gemini-2.5-flash")
  },
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    // Get API key from environment
    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Use provided model or default to Claude 3.5 Sonnet
    const model = args.model || 'google/gemini-2.5-flash';

    try {
      // 1. Save user message to database
      await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
        userId,
        role: 'user',
        content: args.message,
        toolCalls: undefined,
        toolResults: undefined,
      });

      // 2. Fetch conversation history (limit to last 50 messages to avoid context overflow)
      const history = await ctx.runQuery(internal.chatbot.chatbot.getRecentHistory, {
        userId,
        limit: 50,
      });

      // 3. Start conversation loop with LLM
      let conversationHistory = history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolResults: msg.toolResults,
      }));

      // Add the new user message to the conversation
      conversationHistory.push({
        role: 'user' as const,
        content: args.message,
        toolCalls: undefined,
        toolResults: undefined,
      });

      let assistantResponse = '';
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        // Call LLM
        const llmResponse = await callLLM(apiKey, model, conversationHistory);

        // If there are tool calls, execute them
        if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
          // Save assistant message with tool calls
          await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
            userId,
            role: 'assistant',
            content: llmResponse.content,
            toolCalls: llmResponse.toolCalls,
            toolResults: undefined,
          });

          // Add to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: llmResponse.content,
            toolCalls: llmResponse.toolCalls,
            toolResults: undefined,
          });

          // Execute tools
          const toolResults: ToolResult[] = [];
          for (const toolCall of llmResponse.toolCalls) {
            let result: string;
            let isError = false;

            try {
              if (toolCall.name === 'list_categories') {
                result = await executeListCategories(
                  ctx,
                  userId,
                  toolCall.input as ListCategoriesInput,
                );
              } else if (toolCall.name === 'list_merchants') {
                result = await executeListMerchants(
                  ctx,
                  userId,
                  toolCall.input as ListMerchantsInput,
                );
              } else if (toolCall.name === 'query_transactions') {
                result = await executeQueryTransactions(
                  ctx,
                  userId,
                  toolCall.input as QueryTransactionsInput,
                );
              } else if (toolCall.name === 'get_category_summary') {
                result = await executeGetCategorySummary(
                  ctx,
                  userId,
                  toolCall.input as GetCategorySummaryInput,
                );
              } else if (toolCall.name === 'list_bank_accounts') {
                result = await executeListBankAccounts(
                  ctx,
                  userId,
                  toolCall.input as ListBankAccountsInput,
                );
              } else if (toolCall.name === 'propose_transaction_update') {
                result = await executeProposeTransactionUpdate(
                  ctx,
                  userId,
                  toolCall.input as ProposeTransactionUpdateInput,
                );
              } else if (toolCall.name === 'confirm_transaction_update') {
                result = await executeConfirmTransactionUpdate(
                  ctx,
                  userId,
                  toolCall.input as ConfirmTransactionUpdateInput,
                );
              } else if (toolCall.name === 'auto_categorize_by_merchant') {
                result = await executeAutoCategorizeByMerchant(
                  ctx,
                  userId,
                  toolCall.input as AutoCategorizeByMerchantInput,
                );
              } else {
                result = `Unknown tool: ${toolCall.name}`;
                isError = true;
              }
            } catch (error) {
              result = `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`;
              isError = true;
            }

            toolResults.push({
              toolCallId: toolCall.id,
              result,
              isError,
            });
          }

          // Save tool results as a user message (this is how Claude expects it)
          await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
            userId,
            role: 'user',
            content: '', // Tool results don't have text content
            toolCalls: undefined,
            toolResults,
          });

          // Add tool results to conversation history
          conversationHistory.push({
            role: 'user',
            content: '',
            toolCalls: undefined,
            toolResults,
          });

          // Continue the loop to let Claude respond to the tool results
        } else {
          // No tool calls, this is the final response
          assistantResponse = llmResponse.content;

          // Save final assistant message
          await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
            userId,
            role: 'assistant',
            content: llmResponse.content,
            toolCalls: undefined,
            toolResults: undefined,
          });

          break;
        }
      }

      if (iteration >= maxIterations) {
        assistantResponse =
          "I've reached my processing limit for this query. Please try breaking down your question into smaller parts.";

        await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
          userId,
          role: 'assistant',
          content: assistantResponse,
          toolCalls: undefined,
          toolResults: undefined,
        });
      }

      return {
        response: assistantResponse,
        success: true,
      };
    } catch (error) {
      console.error('Error in chatbot sendMessage:', error);

      const errorMessage = `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;

      // Save error message
      await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
        userId,
        role: 'assistant',
        content: errorMessage,
        toolCalls: undefined,
        toolResults: undefined,
      });

      return {
        response: errorMessage,
        success: false,
      };
    }
  },
});

/**
 * Get conversation history for the current user
 * Returns messages in chronological order (oldest first)
 */
export const getConversationHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;
    const limit = args.limit ?? 100;

    const messages = await ctx.db
      .query('chatMessage')
      .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
      .order('asc')
      .take(limit);

    return messages;
  },
});

/**
 * Internal query to get recent history for conversation context
 * Used by sendMessage action
 */
export const getRecentHistory = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('chatMessage')
      .withIndex('by_userId_timestamp', (q) => q.eq('userId', args.userId))
      .order('desc') // Get most recent first
      .take(args.limit);

    // Reverse to get chronological order
    return messages.reverse();
  },
});

/**
 * Clear the conversation history for the current user
 */
export const clearConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const userId = identity.subject;

    // Get all messages for the user
    const messages = await ctx.db
      .query('chatMessage')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    // Delete all messages
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    return { deletedCount: messages.length };
  },
});

/**
 * Internal mutation to save a message to the database
 */
export const saveMessage = internalMutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    toolCalls: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          input: v.any(),
        }),
      ),
    ),
    toolResults: v.optional(
      v.array(
        v.object({
          toolCallId: v.string(),
          result: v.any(),
          isError: v.optional(v.boolean()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    await ctx.db.insert('chatMessage', {
      userId: args.userId,
      role: args.role,
      content: args.content,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,
      timestamp,
      createdAt: timestamp,
    });
  },
});
