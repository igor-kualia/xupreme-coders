import { Injectable, computed, inject, signal } from '@angular/core';
import { api } from '../../../convex/_generated/api';
import type { Doc } from '../../../convex/_generated/dataModel';
import { ConvexService } from './convex.service';

export type ChatMessage = Doc<'chatMessage'>;

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private convex = inject(ConvexService);

  private readonly conversationHistory = this.convex.query(
    api.chatbot.chatbot.getConversationHistory,
    {},
  );

  readonly messages = computed<ChatMessage[]>(() => {
    const history = this.conversationHistory();
    return (history as ChatMessage[]) || [];
  });

  readonly isConversationLoaded = computed<boolean>(() => {
    return this.conversationHistory() !== undefined;
  });

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  async sendMessage(content: string): Promise<void> {
    if (!content.trim()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.convex.action(api.chatbot.chatbot.sendMessage, {
        message: content,
      });
    } catch (err) {
      console.error('Error sending message:', err);
      this.error.set(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      this.isLoading.set(false);
    }
  }

  async clearConversation(): Promise<void> {
    this.error.set(null);

    try {
      await this.convex.mutation(api.chatbot.chatbot.clearConversation, {});
    } catch (err) {
      console.error('Error clearing conversation:', err);
      this.error.set(err instanceof Error ? err.message : 'Failed to clear conversation');
    }
  }
}
