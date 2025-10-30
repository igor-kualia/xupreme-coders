/**
 * LLM pricing and cost calculation utilities
 */

import OpenAI from 'openai';

/**
 * Pricing data for models (per 1M tokens in USD)
 * Data sourced from OpenRouter pricing as of January 2025
 */
interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Google models
  'google/gemini-2.5-flash': {
    inputPer1M: 0.1,
    outputPer1M: 0.35,
  },
  'google/gemini-2.0-flash-exp': {
    inputPer1M: 0.0,
    outputPer1M: 0.0,
  },
  'google/gemini-pro': {
    inputPer1M: 0.5,
    outputPer1M: 1.5,
  },
  'google/gemini-pro-1.5': {
    inputPer1M: 1.25,
    outputPer1M: 5.0,
  },

  // OpenAI models
  'openai/gpt-4o': {
    inputPer1M: 2.5,
    outputPer1M: 10.0,
  },
  'openai/gpt-4o-mini': {
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  'openai/gpt-4-turbo': {
    inputPer1M: 10.0,
    outputPer1M: 30.0,
  },
  'openai/gpt-3.5-turbo': {
    inputPer1M: 0.5,
    outputPer1M: 1.5,
  },

  // Anthropic models
  'anthropic/claude-3.5-sonnet': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  'anthropic/claude-3-opus': {
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },
  'anthropic/claude-3-haiku': {
    inputPer1M: 0.25,
    outputPer1M: 1.25,
  },
  'anthropic/claude-3.5-haiku': {
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },

  // Meta models
  'meta-llama/llama-3.1-70b-instruct': {
    inputPer1M: 0.35,
    outputPer1M: 0.4,
  },
  'meta-llama/llama-3.1-8b-instruct': {
    inputPer1M: 0.06,
    outputPer1M: 0.06,
  },
};

/**
 * Calculate cost from token usage
 */
export function calculateCostFromTokens(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    // If model not in pricing table, return 0 and log warning
    console.warn(`No pricing data for model: ${model}`);
    return 0;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Extract token usage from OpenAI API response
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function extractTokenUsage(response: OpenAI.ChatCompletion): TokenUsage | null {
  if (!response.usage) {
    return null;
  }

  return {
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens,
  };
}

/**
 * Extract cost from OpenRouter response headers or metadata
 * OpenRouter may include cost information in response headers or in the response body
 */
export function extractCostFromOpenRouter(response: OpenAI.ChatCompletion): number | null {
  // OpenRouter may include cost in response metadata
  // This is a placeholder - actual implementation depends on OpenRouter's API
  // For now, we'll rely on calculated costs

  // Check if there's any cost metadata (OpenRouter specific)
  // @ts-expect-error - OpenRouter may add custom fields
  if (response.cost !== undefined) {
    // @ts-expect-error - OpenRouter may add custom fields
    return response.cost as number;
  }

  return null;
}

/**
 * Get cost for an LLM call
 * Tries to extract from OpenRouter first, falls back to calculation
 */
export interface CostResult {
  cost: number;
  source: 'openrouter' | 'calculated';
}

export function getCostForLLMCall(
  response: OpenAI.ChatCompletion,
  model: string,
): CostResult | null {
  // Try to extract cost from OpenRouter
  const openRouterCost = extractCostFromOpenRouter(response);
  if (openRouterCost !== null) {
    return {
      cost: openRouterCost,
      source: 'openrouter',
    };
  }

  // Fall back to calculated cost
  const tokenUsage = extractTokenUsage(response);
  if (!tokenUsage) {
    return null;
  }

  const calculatedCost = calculateCostFromTokens(
    model,
    tokenUsage.promptTokens,
    tokenUsage.completionTokens,
  );

  return {
    cost: calculatedCost,
    source: 'calculated',
  };
}

/**
 * Add a new model to the pricing table (for dynamic updates)
 */
export function addModelPricing(model: string, pricing: ModelPricing): void {
  MODEL_PRICING[model] = pricing;
}

/**
 * Get pricing for a model
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null;
}
