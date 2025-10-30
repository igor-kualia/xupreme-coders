/**
 * Command system for AI chat to render special UI components
 *
 * Commands use the format: [RENDER:component-type:json-data]
 * Example: [RENDER:transaction-table:{"transactionIds":["id1","id2"]}]
 */

export type ChatCommandType =
  | 'transaction-table'
  | 'category-chart'
  | 'bank-account-table'
  | 'transaction-edit-preview';

export interface TransactionTableCommand {
  transactionIds: string[];
}

export interface CategoryChartCommand {
  categoryIds: string[];
  chartType: 'pie' | 'bar' | 'table';
  startDate?: string;
  endDate?: string;
  transactionType?: 'income' | 'expense' | 'transfer' | 'all';
}

export interface BankAccountTableCommand {
  accountIds: string[];
}

export interface TransactionEditPreviewCommand {
  transactionIds: string[];
  updates: {
    categoryId?: string;
    categoryName?: string;
    date?: string;
    amount?: number;
  };
}

export type ChatCommandData =
  | TransactionTableCommand
  | CategoryChartCommand
  | BankAccountTableCommand
  | TransactionEditPreviewCommand;

export interface ChatCommand {
  type: ChatCommandType;
  data: ChatCommandData;
}

/**
 * Type guard to check if command data is TransactionTableCommand
 */
export function isTransactionTableCommand(
  type: ChatCommandType,
  data: ChatCommandData,
): data is TransactionTableCommand {
  return type === 'transaction-table';
}

/**
 * Type guard to check if command data is CategoryChartCommand
 */
export function isCategoryChartCommand(
  type: ChatCommandType,
  data: ChatCommandData,
): data is CategoryChartCommand {
  return type === 'category-chart';
}

/**
 * Type guard to check if command data is BankAccountTableCommand
 */
export function isBankAccountTableCommand(
  type: ChatCommandType,
  data: ChatCommandData,
): data is BankAccountTableCommand {
  return type === 'bank-account-table';
}

/**
 * Type guard to check if command data is TransactionEditPreviewCommand
 */
export function isTransactionEditPreviewCommand(
  type: ChatCommandType,
  data: ChatCommandData,
): data is TransactionEditPreviewCommand {
  return type === 'transaction-edit-preview';
}

export interface ChatMessageSegment {
  type: 'text' | 'component';
  content: string;
  command?: ChatCommand;
}

/**
 * Regular expression to match command markers in message content
 * Format: [RENDER:component-type:json-data]
 * Note: Simple pattern to find command starts, we parse JSON manually to handle nesting
 */
export const COMMAND_PATTERN = /\[RENDER:([^:]+):/g;

/**
 * Parses message content and extracts command markers
 * @param content - Raw message content with potential command markers
 * @returns Array of segments containing text and commands
 */
export function parseMessageCommands(content: string): ChatMessageSegment[] {
  const segments: ChatMessageSegment[] = [];
  let lastIndex = 0;

  // Clean up any markdown artifacts or stray JSON formatting from LLM responses
  // Remove lines that are just closing braces (common with some LLMs)
  const cleanedContent = content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      // Filter out lines that are just braces or quotes with braces
      return trimmed !== '}}' && trimmed !== '"}}"' && trimmed !== '"{{' && trimmed !== '{{';
    })
    .join('\n');

  const matches = cleanedContent.matchAll(COMMAND_PATTERN);

  for (const match of matches) {
    const [, commandType] = match;
    const matchIndex = match.index!;
    const commandStart = matchIndex;
    const jsonStart = matchIndex + match[0].length;

    // Find the JSON object by counting braces
    let braceCount = 0;
    let jsonEnd = jsonStart;
    let inString = false;
    let escapeNext = false;

    for (let i = jsonStart; i < cleanedContent.length; i++) {
      const char = cleanedContent[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    // Check if we found a complete JSON object followed by ]
    // Skip any extra closing braces or whitespace between JSON and ]
    let closingBracketPos = jsonEnd;
    while (
      closingBracketPos < cleanedContent.length &&
      (cleanedContent[closingBracketPos] === '}' || /\s/.test(cleanedContent[closingBracketPos]))
    ) {
      closingBracketPos++;
    }

    if (braceCount === 0 && cleanedContent[closingBracketPos] === ']') {
      const fullMatch = cleanedContent.slice(commandStart, closingBracketPos + 1);
      const jsonData = cleanedContent.slice(jsonStart, jsonEnd);

      if (matchIndex > lastIndex) {
        segments.push({
          type: 'text',
          content: cleanedContent.slice(lastIndex, matchIndex),
        });
      }

      try {
        const data = JSON.parse(jsonData);
        segments.push({
          type: 'component',
          content: fullMatch,
          command: {
            type: commandType as ChatCommandType,
            data,
          },
        });
      } catch (error) {
        console.error('Failed to parse command data:', error);
        segments.push({
          type: 'text',
          content: fullMatch,
        });
      }

      lastIndex = closingBracketPos + 1;
    } else {
      // Invalid command format, treat as text
      if (matchIndex > lastIndex) {
        segments.push({
          type: 'text',
          content: cleanedContent.slice(lastIndex, matchIndex),
        });
      }
      lastIndex = matchIndex;
    }
  }

  if (lastIndex < cleanedContent.length) {
    segments.push({
      type: 'text',
      content: cleanedContent.slice(lastIndex),
    });
  }

  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: cleanedContent,
    });
  }

  return segments;
}
