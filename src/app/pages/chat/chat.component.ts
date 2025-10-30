import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { marked } from 'marked';
import { HlmDialogService } from '../../lib/ui/ui-dialog-helm/src';
import { ClearChatDialogComponent } from './clear-chat-dialog.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUp, lucidePlus } from '@ng-icons/lucide';
import {
  BankAccountTableCommand,
  CategoryChartCommand,
  ChatCommandData,
  isCategoryChartCommand,
  isTransactionEditPreviewCommand,
  isTransactionTableCommand,
  parseMessageCommands,
  ChatMessageSegment,
  TransactionEditPreviewCommand,
  TransactionTableCommand,
} from '../../types/chat-commands';
import { ChatTransactionTableComponent } from './chat-transaction-table.component';
import { ChatCategoryChartComponent } from './chat-category-chart.component';
import { ChatBankAccountTableComponent } from './chat-bank-account-table.component';
import { ChatTransactionEditPreviewComponent } from './chat-transaction-edit-preview.component';

@Component({
  selector: 'app-chat',
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    ChatTransactionTableComponent,
    ChatCategoryChartComponent,
    ChatBankAccountTableComponent,
    ChatTransactionEditPreviewComponent,
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideIcons({ lucideArrowUp, lucidePlus })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatComponent {
  private chatService = inject(ChatService);
  private sanitizer = inject(DomSanitizer);
  private dialogService = inject(HlmDialogService);

  readonly isLoading = this.chatService.isLoading;
  readonly error = this.chatService.error;
  readonly messageQueue = this.chatService.messageQueue;
  readonly isConversationLoaded = this.chatService.isConversationLoaded;

  readonly messages = computed(() => {
    return this.chatService
      .messages()
      .filter((msg) => msg.content.trim().length > 0)
      .reverse();
  });

  readonly messageInput = signal<string>('');
  readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  readonly messageTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('messageTextarea');

  readonly canSend = computed(() => {
    return this.messageInput().trim().length > 0;
  });

  private typewriterContent = signal<Map<string, string>>(new Map());
  private lastProcessedMessageId = signal<string | null>(null);
  private initialMessageCount = signal<number>(0);
  private hasUserSentMessage = signal<boolean>(false);
  private completedAnimations = signal<Set<string>>(new Set());
  private isAnimating = signal<boolean>(false);
  private parsedSegmentsCache = new Map<string, ChatMessageSegment[]>();

  constructor() {
    effect(
      () => {
        const messages = this.messages();
        if (messages.length > 0) {
          this.scrollToBottom();

          if (this.initialMessageCount() === 0) {
            this.initialMessageCount.set(messages.length);
            const initialMap = new Map<string, string>();
            const initialCompleted = new Set<string>();
            for (const message of messages) {
              initialMap.set(message._id, message.content);
              initialCompleted.add(message._id);
            }
            this.typewriterContent.set(initialMap);
            this.completedAnimations.set(initialCompleted);

            // Mark the latest assistant message from initial load as already processed
            // to prevent it from animating when new messages arrive
            const latestAssistantMessage = messages.find((msg) => msg.role === 'assistant');
            if (latestAssistantMessage) {
              this.lastProcessedMessageId.set(latestAssistantMessage._id);
            }
          }

          if (this.hasUserSentMessage()) {
            this.startTypewriterEffect(messages);
          }
        }
      },
      { allowSignalWrites: true },
    );

    // Auto-resize textarea as user types
    effect(() => {
      this.messageInput(); // Track changes to messageInput
      this.resizeTextarea();
    });
  }

  private startTypewriterEffect(
    messages: typeof this.messages extends () => infer T ? T : never,
  ): void {
    // Find the first assistant message that hasn't been processed yet
    const unprocessedMessage = messages
      .slice()
      .reverse()
      .find(
        (msg) =>
          msg.role === 'assistant' &&
          !this.completedAnimations().has(msg._id) &&
          this.lastProcessedMessageId() !== msg._id,
      );

    // If we're already animating or no unprocessed messages, return
    if (this.isAnimating() || !unprocessedMessage) {
      return;
    }

    // Check if all previous messages are completed
    const messagesReversed = messages.slice().reverse();
    const messageIndex = messagesReversed.findIndex((m) => m._id === unprocessedMessage._id);
    const previousMessages = messagesReversed.slice(0, messageIndex);
    const allPreviousCompleted = previousMessages.every(
      (msg) => msg.role === 'user' || this.completedAnimations().has(msg._id),
    );

    if (!allPreviousCompleted) {
      return;
    }

    this.isAnimating.set(true);
    this.lastProcessedMessageId.set(unprocessedMessage._id);

    const fullContent = unprocessedMessage.content;

    // Parse the content to detect commands
    const segments = parseMessageCommands(fullContent);
    const hasCommands = segments.some((seg) => seg.type === 'component');

    // If there are commands, we need to animate text but show commands immediately
    if (hasCommands) {
      this.animateWithCommands(unprocessedMessage._id, fullContent, segments);
      return;
    }

    // No commands, proceed with normal typewriter animation
    this.animateTextOnly(unprocessedMessage._id, fullContent);
  }

  private animateWithCommands(
    messageId: string,
    fullContent: string,
    segments: ChatMessageSegment[],
  ): void {
    let currentSegmentIndex = 0;
    let currentCharInSegment = 0;
    const speed = 10;

    const animateNextPart = () => {
      // Check if animation is complete (all segments processed)
      if (currentSegmentIndex >= segments.length) {
        // Animation complete, show full content
        const currentMap = new Map(this.typewriterContent());
        currentMap.set(messageId, fullContent);
        this.typewriterContent.set(currentMap);

        const completedSet = new Set(this.completedAnimations());
        completedSet.add(messageId);
        this.completedAnimations.set(completedSet);
        this.isAnimating.set(false);

        setTimeout(() => {
          this.startTypewriterEffect(this.messages());
        }, 100);
        return;
      }

      const currentSegment = segments[currentSegmentIndex];

      // Build display content: show all previous segments + current partial segment
      let displayContent = '';

      for (let i = 0; i < segments.length; i++) {
        if (i < currentSegmentIndex) {
          // Previous segments - show fully
          displayContent += segments[i].content;
        } else if (i === currentSegmentIndex) {
          // Current segment
          if (currentSegment.type === 'component') {
            // Components are shown fully immediately
            displayContent += currentSegment.content;
            // Move to next segment
            currentSegmentIndex++;
            currentCharInSegment = 0;

            const currentMap = new Map(this.typewriterContent());
            currentMap.set(messageId, displayContent);
            this.typewriterContent.set(currentMap);

            // Continue with next segment immediately
            setTimeout(animateNextPart, 10);
            return;
          } else {
            // Text segment - show character by character
            displayContent += currentSegment.content.substring(0, currentCharInSegment);
          }
        }
        // Segments after current index are not shown yet
      }

      const currentMap = new Map(this.typewriterContent());
      currentMap.set(messageId, displayContent);
      this.typewriterContent.set(currentMap);

      // Advance to next character or segment
      currentCharInSegment++;

      if (currentCharInSegment > currentSegment.content.length) {
        // Current text segment is complete, move to next segment
        currentSegmentIndex++;
        currentCharInSegment = 0;
      }

      setTimeout(animateNextPart, speed);
    };

    animateNextPart();
  }

  private animateTextOnly(messageId: string, fullContent: string): void {
    let currentIndex = 0;
    const speed = 10;

    const typeNextChar = () => {
      if (currentIndex < fullContent.length) {
        const currentMap = new Map(this.typewriterContent());
        currentMap.set(messageId, fullContent.substring(0, currentIndex + 1));
        this.typewriterContent.set(currentMap);
        currentIndex++;
        setTimeout(typeNextChar, speed);
      } else {
        const currentMap = new Map(this.typewriterContent());
        currentMap.set(messageId, fullContent);
        this.typewriterContent.set(currentMap);

        // Mark animation as complete
        const completedSet = new Set(this.completedAnimations());
        completedSet.add(messageId);
        this.completedAnimations.set(completedSet);
        this.isAnimating.set(false);

        // Try to animate the next message
        setTimeout(() => {
          this.startTypewriterEffect(this.messages());
        }, 100);
      }
    };

    typeNextChar();
  }

  getDisplayContent(messageId: string, originalContent: string): string {
    const content = this.typewriterContent().get(messageId);
    return content !== undefined ? content : originalContent;
  }

  shouldShowMessage(messageId: string, role: string): boolean {
    // Always show user messages
    if (role === 'user') {
      return true;
    }

    // Show assistant messages that are completed or currently being animated
    return this.completedAnimations().has(messageId) || this.lastProcessedMessageId() === messageId;
  }

  async sendMessage(): Promise<void> {
    if (!this.canSend()) {
      return;
    }

    const content = this.messageInput();
    this.messageInput.set('');
    this.hasUserSentMessage.set(true);

    // Reset textarea height and refocus
    setTimeout(() => {
      const textarea = this.messageTextarea()?.nativeElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.focus();
      }
    }, 0);

    await this.chatService.sendMessage(content);
  }

  async sendQuickMessage(message: string): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.hasUserSentMessage.set(true);

    // Focus the textarea after sending a quick message
    setTimeout(() => {
      this.messageTextarea()?.nativeElement.focus();
    }, 0);

    await this.chatService.sendMessage(message);
  }

  openClearChatDialog(): void {
    const dialogRef = this.dialogService.open(ClearChatDialogComponent, {
      context: {
        onConfirm: async () => {
          await this.chatService.clearConversation();
          this.hasUserSentMessage.set(false);
          this.initialMessageCount.set(0);
          this.lastProcessedMessageId.set(null);
          this.typewriterContent.set(new Map());
          this.completedAnimations.set(new Set());
          this.isAnimating.set(false);
          this.parsedSegmentsCache.clear();
        },
        onClose: () => {
          dialogRef.close();
        },
      },
    });
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer()?.nativeElement;
      if (container) {
        container.scrollTop = 0;
      }
    }, 100);
  }

  getRenderedMarkdown(content: string): SafeHtml {
    const html = marked.parse(content, { async: false }) as string;
    return this.sanitizer.sanitize(1, html) || '';
  }

  /**
   * Parse message content into segments (text and commands)
   * Uses caching to avoid re-parsing on every change detection
   */
  parseMessageSegments(messageId: string, content: string): ChatMessageSegment[] {
    const cacheKey = `${messageId}:${content}`;

    if (!this.parsedSegmentsCache.has(cacheKey)) {
      this.parsedSegmentsCache.set(cacheKey, parseMessageCommands(content));

      // Clean up old cache entries (keep last 50)
      if (this.parsedSegmentsCache.size > 50) {
        const keysToDelete = Array.from(this.parsedSegmentsCache.keys()).slice(
          0,
          this.parsedSegmentsCache.size - 50,
        );
        keysToDelete.forEach((key) => this.parsedSegmentsCache.delete(key));
      }
    }

    return this.parsedSegmentsCache.get(cacheKey)!;
  }

  /**
   * Auto-resize textarea based on content
   */
  private resizeTextarea(): void {
    setTimeout(() => {
      const textarea = this.messageTextarea()?.nativeElement;
      if (textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        // Set height to scrollHeight, but max out at 200px (about 8-10 lines)
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
      }
    }, 0);
  }

  /**
   * Focus the textarea when clicking on the input container
   */
  focusTextarea(event: MouseEvent): void {
    // Only focus if clicking on the container itself, not on buttons
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    this.messageTextarea()?.nativeElement.focus();
  }

  /**
   * Type guard for transaction table command
   */
  isTransactionTableCommand = isTransactionTableCommand;

  /**
   * Type guard for category chart command
   */
  isCategoryChartCommand = isCategoryChartCommand;

  /**
   * Type guard for transaction edit preview command
   */
  isTransactionEditPreviewCommand = isTransactionEditPreviewCommand;

  /**
   * Cast command data to TransactionTableCommand
   */
  asTransactionTableCommand(data: ChatCommandData): TransactionTableCommand {
    return data as TransactionTableCommand;
  }

  /**
   * Cast command data to CategoryChartCommand
   */
  asCategoryChartCommand(data: ChatCommandData): CategoryChartCommand {
    return data as CategoryChartCommand;
  }

  /**
   * Cast command data to BankAccountTableCommand
   */
  asBankAccountTableCommand(data: ChatCommandData): BankAccountTableCommand {
    return data as BankAccountTableCommand;
  }

  /**
   * Cast command data to TransactionEditPreviewCommand
   */
  asTransactionEditPreviewCommand(data: ChatCommandData): TransactionEditPreviewCommand {
    return data as TransactionEditPreviewCommand;
  }
}
