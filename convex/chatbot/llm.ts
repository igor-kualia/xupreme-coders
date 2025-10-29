/**
 * LLM integration for chatbot using OpenRouter
 */

import OpenAI from 'openai';
import { LIST_CATEGORIES_TOOL, LIST_MERCHANTS_TOOL, QUERY_TRANSACTIONS_TOOL } from './tools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  isError?: boolean;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
}

/**
 * Build system prompt for the chatbot
 */
export function buildSystemPrompt(): string {
  // Get current date in a clear format for the LLM
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return `You are KeyBank AI, a helpful financial assistant for the XupremeCoders finance tracking application.

IMPORTANT: Today's date is ${currentDate} (${currentMonth}). Use this to correctly interpret relative date references like "last month", "last August", "this year", etc.

Your role is to help users understand their financial data, analyze spending patterns, and answer questions about their transactions.

Available Tools:
1. list_categories - Use this to find category IDs when users ask about spending on specific categories (e.g., "groceries", "restaurants", "utilities")
2. list_merchants - Use this to find merchant IDs when users ask about specific stores or merchants (e.g., "Walmart", "Starbucks")
3. query_transactions - Use this to query and aggregate transaction data with filters

Guidelines:
- Be concise and friendly in your responses
- ALWAYS use list_categories or list_merchants FIRST to find IDs before filtering transactions by category or merchant
- Format currency amounts clearly (e.g., $1,234.56)
- Provide insights and analysis when appropriate
- When showing transaction lists, format them clearly with dates, merchants, amounts, and categories
- Be proactive about suggesting analyses that might be helpful (e.g., "Would you like to see how this compares to last month?")
- When interpreting dates, always consider the current date provided above. For example:
  - "last August" means August of the previous year if we're past August, or August of this year if we haven't reached August yet
  - "this month" refers to ${currentMonth}
  - "last month" refers to the month before ${currentMonth}

SPECIAL UI COMMANDS:
When you want to display transactions in a visual table format (recommended for 3+ transactions), use this special command syntax:

[RENDER:transaction-table:{"transactionIds":["id1","id2","id3"]}]

Usage Guidelines:
- Use this command when users ask to see specific transactions, top expenses, largest purchases, etc.
- Place the command AFTER your explanatory text (e.g., "Here are your top 10 expenses for this month:\n[RENDER:transaction-table:{...}]")
- Include the transaction IDs returned from the query_transactions tool
- The UI will render an interactive table with these transactions
- You can still provide a summary in regular text before or after the command
- Recommended for queries returning 3 or more transactions
- For 1-2 transactions, formatting them in text is fine

Example Response:
"Here are your top 10 expenses for this month:

[RENDER:transaction-table:{"transactionIds":["abc123","def456","ghi789"]}]

Your largest expense was $450.00 at Whole Foods Market. Would you like to see how this compares to last month?"

Workflow Example:
User: "What did I spend on groceries?"
1. Call list_categories with searchTerm: "groceries" to find the grocery category ID
2. Call query_transactions with the categoryIds from step 1 and aggregation: "sum"
3. Provide a clear answer with the total amount

Remember: You have access to the user's real financial data through these tools. Always use them to provide accurate, data-driven responses.`;
}

/**
 * Format conversation history for OpenAI API format
 */
export function formatConversationHistory(
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  }>,
): OpenAI.ChatCompletionMessageParam[] {
  const formattedMessages: OpenAI.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Check if this is a tool result message
      if (msg.toolResults && msg.toolResults.length > 0) {
        // Add tool result messages
        for (const result of msg.toolResults) {
          formattedMessages.push({
            role: 'tool',
            tool_call_id: result.toolCallId,
            content: JSON.stringify(result.result),
          });
        }
      } else if (msg.content) {
        // Regular user message
        formattedMessages.push({
          role: 'user',
          content: msg.content,
        });
      }
    } else if (msg.role === 'assistant') {
      // Assistant messages with optional tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formattedMessages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        });
      } else {
        // Regular assistant message
        formattedMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }
  }

  return formattedMessages;
}

/**
 * Call LLM via OpenRouter with tool support
 */
export async function callLLM(
  apiKey: string,
  model: string,
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  }>,
  newUserMessage?: string,
): Promise<LLMResponse> {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env['CONVEX_SITE_URL'] ?? 'http://localhost:4200',
      'X-Title': 'XupremeCoders Chatbot',
    },
  });

  // Build messages array
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPrompt(),
    },
    ...formatConversationHistory(conversationHistory),
  ];

  // Add new user message if provided
  if (newUserMessage) {
    messages.push({
      role: 'user',
      content: newUserMessage,
    });
  }

  // Call OpenRouter API
  const response = await client.chat.completions.create({
    model: model,
    messages: messages,
    tools: [
      {
        type: 'function',
        function: {
          name: LIST_CATEGORIES_TOOL.name,
          description: LIST_CATEGORIES_TOOL.description,
          parameters: LIST_CATEGORIES_TOOL.input_schema,
        },
      },
      {
        type: 'function',
        function: {
          name: LIST_MERCHANTS_TOOL.name,
          description: LIST_MERCHANTS_TOOL.description,
          parameters: LIST_MERCHANTS_TOOL.input_schema,
        },
      },
      {
        type: 'function',
        function: {
          name: QUERY_TRANSACTIONS_TOOL.name,
          description: QUERY_TRANSACTIONS_TOOL.description,
          parameters: QUERY_TRANSACTIONS_TOOL.input_schema,
        },
      },
    ],
    temperature: 0.7,
  });

  const choice = response.choices[0];
  if (!choice) {
    throw new Error('No response from LLM');
  }

  // Parse response
  const textContent = choice.message.content || '';
  const toolCalls: ToolCall[] = [];

  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type === 'function') {
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
    }
  }

  return {
    content: textContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: choice.finish_reason || 'stop',
  };
}
