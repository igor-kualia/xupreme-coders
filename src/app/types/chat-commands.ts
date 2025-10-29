/**
 * Command system for AI chat to render special UI components
 *
 * Commands use the format: [RENDER:component-type:json-data]
 * Example: [RENDER:transaction-table:{"transactionIds":["id1","id2"]}]
 */

export type ChatCommandType = 'transaction-table';

export interface TransactionTableCommand {
  transactionIds: string[];
}

export type ChatCommandData = TransactionTableCommand;

export interface ChatCommand {
  type: ChatCommandType;
  data: ChatCommandData;
}

export interface ChatMessageSegment {
  type: 'text' | 'component';
  content: string;
  command?: ChatCommand;
}

/**
 * Regular expression to match command markers in message content
 * Format: [RENDER:component-type:json-data]
 */
export const COMMAND_PATTERN = /\[RENDER:([^:]+):(\{[^}]+\})\]/g;

/**
 * Parses message content and extracts command markers
 * @param content - Raw message content with potential command markers
 * @returns Array of segments containing text and commands
 */
export function parseMessageCommands(content: string): ChatMessageSegment[] {
  const segments: ChatMessageSegment[] = [];
  let lastIndex = 0;

  const matches = content.matchAll(COMMAND_PATTERN);

  for (const match of matches) {
    const [fullMatch, commandType, jsonData] = match;
    const matchIndex = match.index!;

    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, matchIndex),
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

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content,
    });
  }

  return segments;
}
