/**
 * Analytics queries for LLM usage tracking
 */

import { v } from 'convex/values';
import { query } from '../_generated/server';

/**
 * Get usage metrics for the current user's session
 * Returns aggregated data for all LLM calls in the current session
 */
export const getUserSessionUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    // Get all LLM usage records for this user
    const llmUsageRecords = await ctx.db
      .query('llmUsage')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    // Get all tool usage records for this user
    const toolUsageRecords = await ctx.db
      .query('toolUsage')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    // Calculate aggregated metrics
    const totalCost = llmUsageRecords.reduce((sum, record) => sum + (record.estimatedCost || 0), 0);
    const totalTokens = llmUsageRecords.reduce((sum, record) => sum + (record.totalTokens || 0), 0);
    const totalPromptTokens = llmUsageRecords.reduce(
      (sum, record) => sum + (record.promptTokens || 0),
      0,
    );
    const totalCompletionTokens = llmUsageRecords.reduce(
      (sum, record) => sum + (record.completionTokens || 0),
      0,
    );
    const totalToolCalls = toolUsageRecords.length;

    // Count successful vs error calls
    const successfulCalls = llmUsageRecords.filter((r) => r.status === 'success').length;
    const errorCalls = llmUsageRecords.filter((r) => r.status === 'error').length;
    const partialCalls = llmUsageRecords.filter((r) => r.status === 'partial').length;

    // Tool usage frequency
    const toolUsageFrequency: Record<string, number> = {};
    for (const toolRecord of toolUsageRecords) {
      toolUsageFrequency[toolRecord.toolName] = (toolUsageFrequency[toolRecord.toolName] || 0) + 1;
    }

    // Average metrics
    const avgLatency =
      llmUsageRecords.length > 0
        ? llmUsageRecords.reduce((sum, record) => sum + (record.latencyMs || 0), 0) /
          llmUsageRecords.length
        : 0;

    return {
      totalLLMCalls: llmUsageRecords.length,
      totalCost,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalToolCalls,
      successfulCalls,
      errorCalls,
      partialCalls,
      toolUsageFrequency,
      avgLatencyMs: avgLatency,
    };
  },
});

/**
 * Get total usage metrics for a user with optional date range
 */
export const getUserTotalUsage = query({
  args: {
    startDate: v.optional(v.string()), // ISO timestamp
    endDate: v.optional(v.string()), // ISO timestamp
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    // Query with date range if provided
    // Note: Convex index queries support only one range bound, so we use gte for startDate
    // and filter endDate in memory
    let llmUsageRecords;
    if (args.startDate) {
      llmUsageRecords = await ctx.db
        .query('llmUsage')
        .withIndex('by_userId_timestamp', (q) =>
          q.eq('userId', userId).gte('timestamp', args.startDate!),
        )
        .collect();
    } else {
      llmUsageRecords = await ctx.db
        .query('llmUsage')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect();
    }

    // Filter by end date if needed
    if (args.endDate) {
      llmUsageRecords = llmUsageRecords.filter((r) => r.timestamp <= args.endDate!);
    }

    // Get tool usage records for the same period
    const llmUsageIds = llmUsageRecords.map((r) => r._id);
    const toolUsageRecords = await ctx.db
      .query('toolUsage')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    // Filter tool usage by date range
    const filteredToolUsage = toolUsageRecords.filter((t) => {
      if (args.startDate && t.timestamp < args.startDate) return false;
      if (args.endDate && t.timestamp > args.endDate) return false;
      return true;
    });

    // Calculate aggregated metrics
    const totalCost = llmUsageRecords.reduce((sum, record) => sum + (record.estimatedCost || 0), 0);
    const totalTokens = llmUsageRecords.reduce((sum, record) => sum + (record.totalTokens || 0), 0);
    const totalPromptTokens = llmUsageRecords.reduce(
      (sum, record) => sum + (record.promptTokens || 0),
      0,
    );
    const totalCompletionTokens = llmUsageRecords.reduce(
      (sum, record) => sum + (record.completionTokens || 0),
      0,
    );

    // Group by model
    const modelUsage: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const record of llmUsageRecords) {
      if (!modelUsage[record.model]) {
        modelUsage[record.model] = { calls: 0, tokens: 0, cost: 0 };
      }
      modelUsage[record.model].calls += 1;
      modelUsage[record.model].tokens += record.totalTokens || 0;
      modelUsage[record.model].cost += record.estimatedCost || 0;
    }

    return {
      totalLLMCalls: llmUsageRecords.length,
      totalCost,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalToolCalls: filteredToolUsage.length,
      modelUsage,
      dateRange: {
        start: args.startDate || null,
        end: args.endDate || null,
      },
    };
  },
});

/**
 * Get detailed tool usage statistics
 */
export const getToolUsageStats = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    // Get all tool usage records
    let toolUsageRecords = await ctx.db
      .query('toolUsage')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();

    // Filter by date range
    if (args.startDate) {
      toolUsageRecords = toolUsageRecords.filter((r) => r.timestamp >= args.startDate!);
    }
    if (args.endDate) {
      toolUsageRecords = toolUsageRecords.filter((r) => r.timestamp <= args.endDate!);
    }

    // Group by tool name
    const toolStats: Record<
      string,
      {
        totalCalls: number;
        successfulCalls: number;
        errorCalls: number;
        avgExecutionTimeMs: number;
        totalExecutionTimeMs: number;
      }
    > = {};

    for (const record of toolUsageRecords) {
      if (!toolStats[record.toolName]) {
        toolStats[record.toolName] = {
          totalCalls: 0,
          successfulCalls: 0,
          errorCalls: 0,
          avgExecutionTimeMs: 0,
          totalExecutionTimeMs: 0,
        };
      }

      toolStats[record.toolName].totalCalls += 1;
      toolStats[record.toolName].totalExecutionTimeMs += record.executionTimeMs;
      if (record.status === 'success') {
        toolStats[record.toolName].successfulCalls += 1;
      } else {
        toolStats[record.toolName].errorCalls += 1;
      }
    }

    // Calculate averages
    for (const toolName in toolStats) {
      const stats = toolStats[toolName];
      stats.avgExecutionTimeMs = stats.totalExecutionTimeMs / stats.totalCalls;
    }

    // Sort by total calls descending
    const sortedTools = Object.entries(toolStats)
      .map(([toolName, stats]) => ({ toolName, ...stats }))
      .sort((a, b) => b.totalCalls - a.totalCalls);

    return {
      tools: sortedTools,
      totalToolCalls: toolUsageRecords.length,
      dateRange: {
        start: args.startDate || null,
        end: args.endDate || null,
      },
    };
  },
});

/**
 * Get recent LLM usage records for debugging/display
 */
export const getRecentLLMUsage = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    const limit = args.limit || 20;

    const records = await ctx.db
      .query('llmUsage')
      .withIndex('by_userId_timestamp', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit);

    return records;
  },
});

/**
 * Get recent tool usage records for debugging/display
 */
export const getRecentToolUsage = query({
  args: {
    limit: v.optional(v.number()),
    toolName: v.optional(v.string()), // Filter by specific tool
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    const limit = args.limit || 20;

    let records;
    if (args.toolName) {
      records = await ctx.db
        .query('toolUsage')
        .withIndex('by_userId_toolName', (q) =>
          q.eq('userId', userId).eq('toolName', args.toolName!),
        )
        .order('desc')
        .take(limit);
    } else {
      records = await ctx.db
        .query('toolUsage')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .order('desc')
        .take(limit);
    }

    return records;
  },
});

/**
 * Get usage for a specific message (LLM call + associated tool calls)
 */
export const getMessageUsage = query({
  args: {
    messageId: v.id('chatMessage'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }
    const userId = identity.subject;

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) {
      throw new Error('Message not found or unauthorized');
    }

    // Get LLM usage for this message
    const llmUsage = await ctx.db
      .query('llmUsage')
      .withIndex('by_messageId', (q) => q.eq('messageId', args.messageId))
      .first();

    // Get tool usage for this message
    const toolUsage = await ctx.db
      .query('toolUsage')
      .withIndex('by_messageId', (q) => q.eq('messageId', args.messageId))
      .collect();

    return {
      message,
      llmUsage,
      toolUsage,
    };
  },
});
