/**
 * LLM integration for chatbot using OpenRouter
 */

import OpenAI from 'openai';
import {
  GET_CATEGORY_SUMMARY_TOOL,
  LIST_BANK_ACCOUNTS_TOOL,
  LIST_CATEGORIES_TOOL,
  LIST_MERCHANTS_TOOL,
  QUERY_TRANSACTIONS_TOOL,
} from './tools';

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
3. query_transactions - Use this to query individual transactions (e.g., "show me my top 5 expenses", "what did I buy at Walmart?", "list my recent transactions")
4. get_category_summary - Use this to analyze spending BY CATEGORY (e.g., "top spending categories", "category breakdown", "where does my money go?")
5. list_bank_accounts - Use this to show bank account balances (e.g., "what are my account balances?", "how much money do I have?", "show me my accounts")

CRITICAL TOOL SELECTION RULES:
- When users ask about CATEGORIES or CATEGORY BREAKDOWNS → ALWAYS use get_category_summary (this will show a chart)
  Examples: "top 5 spending categories", "category breakdown", "where did I spend the most", "spending by category"

- When users ask about SPECIFIC TRANSACTIONS or EXPENSES → use query_transactions (this will show a table)
  Examples: "top 5 expenses", "my largest purchases", "show me transactions", "what did I spend at Target"

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

1. Transaction Table Command (for showing individual transactions):
[RENDER:transaction-table:{"transactionIds":["id1","id2","id3"]}]

Usage Guidelines:
- Use this command when users ask to see specific transactions, top expenses, largest purchases, etc.
- Place the command AFTER your explanatory text
- Include the transaction IDs returned from the query_transactions tool
- Recommended for queries returning 3 or more transactions

2. Category Chart Command (for showing spending by category):
[RENDER:category-chart:{"categoryIds":["id1","id2"],"chartType":"pie"|"bar"|"table","startDate":"...","endDate":"...","transactionType":"expense"|"income"|"all"}]

IMPORTANT: The get_category_summary tool automatically generates this command for you. Do NOT manually construct this command.

Usage Guidelines:
- Use get_category_summary tool when users ask about:
  * "Show me my spending by category"
  * "Category breakdown"
  * "Where does my money go?"
  * "Top spending categories"
- The tool will automatically return the RENDER command with the right data
- Choose chartType based on results:
  * "pie" - for 2-6 categories (shows proportions nicely)
  * "bar" - for 7+ categories (easier to compare many values)
  * "table" - when users want detailed numbers or all data points
- Displays: total amount, transaction count, percentage, and average per transaction

Example Response with Category Chart:
"Here's your spending breakdown for January 2025:

[RENDER:category-chart:{"categoryIds":["..."],"chartType":"pie","startDate":"2025-01-01T00:00:00.000Z","endDate":"2025-01-31T23:59:59.999Z","transactionType":"expense"}]

Your top category was Groceries at $450.00. Would you like to see the individual transactions?"

Workflow Examples:

Example 1 - Category breakdown query (use get_category_summary):
User: "Show me my top 5 spending categories"
1. Call get_category_summary with chartType: "pie" or "bar"
2. The tool will automatically return the chart command
3. Provide a brief summary highlighting the top category

Example 2 - Specific transaction query (use query_transactions):
User: "Show me my top 5 expenses"
1. Call query_transactions with aggregation: "top_expenses" and limit: 5
2. The tool will automatically return both text list AND table command
3. Provide context about the expenses

Example 3 - Category-specific spending (query_transactions):
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
      {
        type: 'function',
        function: {
          name: GET_CATEGORY_SUMMARY_TOOL.name,
          description: GET_CATEGORY_SUMMARY_TOOL.description,
          parameters: GET_CATEGORY_SUMMARY_TOOL.input_schema,
        },
      },
      {
        type: 'function',
        function: {
          name: LIST_BANK_ACCOUNTS_TOOL.name,
          description: LIST_BANK_ACCOUNTS_TOOL.description,
          parameters: LIST_BANK_ACCOUNTS_TOOL.input_schema,
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
