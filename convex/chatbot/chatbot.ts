/**
 * Main chatbot actions and queries
 */

import { v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { action, internalMutation, internalQuery, mutation, query } from '../_generated/server';
import { executeAutoCategorizeByMerchant } from './autoCategorize';
import { callLLM, ToolResult } from './llm';
import { getCostForLLMCall } from './pricing';
import {
  AutoCategorizeByMerchantInput,
  ConfirmTransactionUpdateInput,
  executeConfirmTransactionUpdate,
  executeGetCategorySummary,
  executeListBankAccounts,
  executeListCategories,
  executeListMerchants,
  executeProposeTransactionUpdate,
  executeQueryTransactions,
  executeRequestAccountConnection,
  GetCategorySummaryInput,
  ListBankAccountsInput,
  ListCategoriesInput,
  ListMerchantsInput,
  ProposeTransactionUpdateInput,
  QueryTransactionsInput,
  RequestAccountConnectionInput,
} from './tools';

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
    const model = args.model || 'google/gemini-2.5-pro';

    // Track usage metrics
    const startTime = Date.now();
    let firstLLMCallTime: number | null = null;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let costSource: 'openrouter' | 'calculated' = 'calculated';
    const toolsUsed: string[] = [];
    const toolExecutionRecords: Array<{
      toolName: string;
      toolCallId: string;
      executionTimeMs: number;
      status: 'success' | 'error';
      errorMessage?: string;
    }> = [];
    let finalMessageId: Id<'chatMessage'> | null = null;
    let iteration = 0;

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
      const maxIterations = 5; // Prevent infinite loops

      while (iteration < maxIterations) {
        iteration++;

        // Track time for first LLM call (latency)
        const llmCallStart = Date.now();

        // Call LLM
        const llmResponse = await callLLM(apiKey, model, conversationHistory);

        // Track first LLM response time
        if (firstLLMCallTime === null) {
          firstLLMCallTime = Date.now() - llmCallStart;
        }

        // Accumulate token usage
        if (llmResponse.usage) {
          totalPromptTokens += llmResponse.usage.promptTokens;
          totalCompletionTokens += llmResponse.usage.completionTokens;
          totalTokens += llmResponse.usage.totalTokens;
        }

        // Calculate cost for this LLM call
        if (llmResponse.rawResponse) {
          const costResult = getCostForLLMCall(llmResponse.rawResponse, model);
          if (costResult) {
            totalCost += costResult.cost;
            costSource = costResult.source;
          }
        }

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
            const toolStartTime = Date.now();

            // Track tool name
            if (!toolsUsed.includes(toolCall.name)) {
              toolsUsed.push(toolCall.name);
            }

            try {
              if (toolCall.name === 'list_categories') {
                result = await executeListCategories(ctx, userId, toolCall.input as ListCategoriesInput);
              } else if (toolCall.name === 'list_merchants') {
                result = await executeListMerchants(ctx, userId, toolCall.input as ListMerchantsInput);
              } else if (toolCall.name === 'query_transactions') {
                result = await executeQueryTransactions(ctx, userId, toolCall.input as QueryTransactionsInput);
              } else if (toolCall.name === 'get_category_summary') {
                result = await executeGetCategorySummary(ctx, userId, toolCall.input as GetCategorySummaryInput);
              } else if (toolCall.name === 'list_bank_accounts') {
                result = await executeListBankAccounts(ctx, userId, toolCall.input as ListBankAccountsInput);
              } else if (toolCall.name === 'propose_transaction_update') {
                result = await executeProposeTransactionUpdate(
                  ctx,
                  userId,
                  toolCall.input as ProposeTransactionUpdateInput
                );
              } else if (toolCall.name === 'confirm_transaction_update') {
                result = await executeConfirmTransactionUpdate(
                  ctx,
                  userId,
                  toolCall.input as ConfirmTransactionUpdateInput
                );
              } else if (toolCall.name === 'auto_categorize_by_merchant') {
                result = await executeAutoCategorizeByMerchant(
                  ctx,
                  userId,
                  toolCall.input as AutoCategorizeByMerchantInput
                );
              } else if (toolCall.name === 'request_account_connection') {
                result = await executeRequestAccountConnection(
                  ctx,
                  userId,
                  toolCall.input as RequestAccountConnectionInput
                );
              } else {
                result = `Unknown tool: ${toolCall.name}`;
                isError = true;
              }
            } catch (error) {
              result = `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`;
              isError = true;
            }

            // Track tool execution time
            const executionTime = Date.now() - toolStartTime;
            toolExecutionRecords.push({
              toolName: toolCall.name,
              toolCallId: toolCall.id,
              executionTimeMs: executionTime,
              status: isError ? 'error' : 'success',
              errorMessage: isError ? result : undefined,
            });

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
          finalMessageId = await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
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

        finalMessageId = await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
          userId,
          role: 'assistant',
          content: assistantResponse,
          toolCalls: undefined,
          toolResults: undefined,
        });
      }

      // Calculate total duration
      const totalDuration = Date.now() - startTime;

      // Save usage data if we have a final message
      if (finalMessageId) {
        const status: 'success' | 'error' | 'partial' = iteration >= maxIterations ? 'partial' : 'success';

        // Save LLM usage
        const llmUsageId = await ctx.runMutation(internal.chatbot.chatbot.saveLLMUsage, {
          userId,
          messageId: finalMessageId,
          model,
          provider: 'openrouter',
          promptTokens: totalPromptTokens || undefined,
          completionTokens: totalCompletionTokens || undefined,
          totalTokens: totalTokens || undefined,
          estimatedCost: totalCost > 0 ? totalCost : undefined,
          costSource: totalCost > 0 ? costSource : undefined,
          toolCallCount: toolExecutionRecords.length || undefined,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          latencyMs: firstLLMCallTime || undefined,
          totalDurationMs: totalDuration,
          iterationCount: iteration,
          status,
        });

        // Save tool usage records
        for (const toolRecord of toolExecutionRecords) {
          await ctx.runMutation(internal.chatbot.chatbot.saveToolUsage, {
            userId,
            messageId: finalMessageId,
            llmUsageId,
            toolName: toolRecord.toolName,
            toolCallId: toolRecord.toolCallId,
            executionTimeMs: toolRecord.executionTimeMs,
            status: toolRecord.status,
            errorMessage: toolRecord.errorMessage,
          });
        }
      }

      return {
        response: assistantResponse,
        success: true,
      };
    } catch (error) {
      console.error('Error in chatbot sendMessage:', error);

      const errorMessage = `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;

      // Save error message
      const errorMessageId = await ctx.runMutation(internal.chatbot.chatbot.saveMessage, {
        userId,
        role: 'assistant',
        content: errorMessage,
        toolCalls: undefined,
        toolResults: undefined,
      });

      // Save error usage data
      const totalDuration = Date.now() - startTime;
      await ctx.runMutation(internal.chatbot.chatbot.saveLLMUsage, {
        userId,
        messageId: errorMessageId,
        model,
        provider: 'openrouter',
        promptTokens: totalPromptTokens || undefined,
        completionTokens: totalCompletionTokens || undefined,
        totalTokens: totalTokens || undefined,
        estimatedCost: totalCost > 0 ? totalCost : undefined,
        costSource: totalCost > 0 ? costSource : undefined,
        toolCallCount: toolExecutionRecords.length || undefined,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        latencyMs: firstLLMCallTime || undefined,
        totalDurationMs: totalDuration,
        iterationCount: iteration,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      // Save tool usage records even on error
      for (const toolRecord of toolExecutionRecords) {
        await ctx.runMutation(internal.chatbot.chatbot.saveToolUsage, {
          userId,
          messageId: errorMessageId,
          llmUsageId: undefined, // No llmUsageId since we're in error handler
          toolName: toolRecord.toolName,
          toolCallId: toolRecord.toolCallId,
          executionTimeMs: toolRecord.executionTimeMs,
          status: toolRecord.status,
          errorMessage: toolRecord.errorMessage,
        });
      }

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
        })
      )
    ),
    toolResults: v.optional(
      v.array(
        v.object({
          toolCallId: v.string(),
          result: v.any(),
          isError: v.optional(v.boolean()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const messageId = await ctx.db.insert('chatMessage', {
      userId: args.userId,
      role: args.role,
      content: args.content,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,
      timestamp,
      createdAt: timestamp,
    });

    return messageId;
  },
});

/**
 * Internal mutation to save LLM usage data
 */
export const saveLLMUsage = internalMutation({
  args: {
    userId: v.string(),
    messageId: v.id('chatMessage'),
    model: v.string(),
    provider: v.string(),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    estimatedCost: v.optional(v.number()),
    costSource: v.optional(v.union(v.literal('openrouter'), v.literal('calculated'))),
    toolCallCount: v.optional(v.number()),
    toolsUsed: v.optional(v.array(v.string())),
    latencyMs: v.optional(v.number()),
    totalDurationMs: v.optional(v.number()),
    iterationCount: v.optional(v.number()),
    status: v.union(v.literal('success'), v.literal('error'), v.literal('partial')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const llmUsageId = await ctx.db.insert('llmUsage', {
      userId: args.userId,
      messageId: args.messageId,
      model: args.model,
      provider: args.provider,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      estimatedCost: args.estimatedCost,
      costSource: args.costSource,
      toolCallCount: args.toolCallCount,
      toolsUsed: args.toolsUsed,
      latencyMs: args.latencyMs,
      totalDurationMs: args.totalDurationMs,
      iterationCount: args.iterationCount,
      status: args.status,
      errorMessage: args.errorMessage,
      timestamp,
    });

    return llmUsageId;
  },
});

/**
 * Internal mutation to save tool usage data
 */
export const saveToolUsage = internalMutation({
  args: {
    userId: v.string(),
    messageId: v.id('chatMessage'),
    llmUsageId: v.optional(v.id('llmUsage')),
    toolName: v.string(),
    toolCallId: v.string(),
    executionTimeMs: v.number(),
    status: v.union(v.literal('success'), v.literal('error')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    await ctx.db.insert('toolUsage', {
      userId: args.userId,
      messageId: args.messageId,
      llmUsageId: args.llmUsageId,
      toolName: args.toolName,
      toolCallId: args.toolCallId,
      executionTimeMs: args.executionTimeMs,
      status: args.status,
      errorMessage: args.errorMessage,
      timestamp,
    });
  },
});
