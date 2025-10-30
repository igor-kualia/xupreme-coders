import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ConvexService } from '../../services/convex.service';

type LLMUsage = Doc<'llmUsage'>;
type ToolUsage = Doc<'toolUsage'>;

interface SessionMetrics {
  totalLLMCalls: number;
  totalCost: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalToolCalls: number;
  successfulCalls: number;
  errorCalls: number;
  partialCalls: number;
  toolUsageFrequency: Record<string, number>;
  avgLatencyMs: number;
}

interface ToolStats {
  tools: Array<{
    toolName: string;
    totalCalls: number;
    successfulCalls: number;
    errorCalls: number;
    avgExecutionTimeMs: number;
    totalExecutionTimeMs: number;
  }>;
  totalToolCalls: number;
}

interface ActivityGroup {
  id: string;
  timestamp: string;
  llmCall: LLMUsage;
  toolCalls: ToolUsage[];
  messageId: Id<'chatMessage'> | undefined;
}

@Component({
  selector: 'app-analytics-panel',
  imports: [CommonModule],
  templateUrl: './analytics-panel.component.html',
  styleUrls: ['./analytics-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPanelComponent {
  private convex = inject(ConvexService);

  // Inputs
  selectedMessageId = input<Id<'chatMessage'> | null>(null);

  // Outputs
  messageSelected = output<Id<'chatMessage'>>();

  // View children
  readonly activityContainer = viewChild<ElementRef<HTMLDivElement>>('activityContainer');

  // Expandable sections state
  readonly expandedSections = signal({
    metrics: true,
  });

  // Query for session usage
  private readonly sessionUsageQuery = this.convex.query(
    api.chatbot.analytics.getUserSessionUsage,
    {},
  );

  // Query for recent LLM usage
  private readonly recentLLMQuery = this.convex.query(api.chatbot.analytics.getRecentLLMUsage, {
    limit: 50,
  });

  // Query for recent tool usage
  private readonly recentToolQuery = this.convex.query(api.chatbot.analytics.getRecentToolUsage, {
    limit: 100,
  });

  // Query for tool stats
  private readonly toolStatsQuery = this.convex.query(api.chatbot.analytics.getToolUsageStats, {});

  // Computed signals
  readonly sessionMetrics = computed<SessionMetrics | undefined>(() => {
    return this.sessionUsageQuery() as SessionMetrics | undefined;
  });

  readonly recentLLMUsage = computed<LLMUsage[]>(() => {
    return (this.recentLLMQuery() as LLMUsage[]) || [];
  });

  readonly recentToolUsage = computed<ToolUsage[]>(() => {
    return (this.recentToolQuery() as ToolUsage[]) || [];
  });

  readonly toolStats = computed<ToolStats | undefined>(() => {
    return this.toolStatsQuery() as ToolStats | undefined;
  });

  // Combined activity timeline grouped by LLM call
  readonly activityTimeline = computed(() => {
    const llmUsage = this.recentLLMUsage();
    const toolUsage = this.recentToolUsage();

    // Create a map of LLM call ID to tool calls
    const toolsByLLMId = new Map<string, ToolUsage[]>();
    toolUsage.forEach((tool) => {
      if (tool.llmUsageId) {
        if (!toolsByLLMId.has(tool.llmUsageId)) {
          toolsByLLMId.set(tool.llmUsageId, []);
        }
        toolsByLLMId.get(tool.llmUsageId)!.push(tool);
      }
    });

    // Create activity groups
    const groups: ActivityGroup[] = llmUsage.map((llm) => {
      const tools = toolsByLLMId.get(llm._id) || [];
      // Sort tools by timestamp
      tools.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        id: llm._id,
        timestamp: llm.timestamp,
        llmCall: llm,
        toolCalls: tools,
        messageId: llm.messageId,
      };
    });

    // Sort groups by timestamp ascending (oldest first)
    groups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return groups;
  });

  constructor() {
    // Auto-scroll when new activities arrive
    effect(
      () => {
        const activities = this.activityTimeline();
        if (activities.length > 0) {
          this.scrollToBottom();
        }
      },
      { allowSignalWrites: true },
    );
  }

  // Helper methods
  toggleSection(section: 'metrics'): void {
    this.expandedSections.update((sections) => ({
      ...sections,
      [section]: !sections[section],
    }));
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.activityContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`;
  }

  formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  }

  formatTime(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms.toFixed(0)}ms`;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60_000) {
      return 'just now';
    }
    // Less than 1 hour
    if (diff < 3_600_000) {
      const minutes = Math.floor(diff / 60_000);
      return `${minutes}m ago`;
    }
    // Less than 1 day
    if (diff < 86_400_000) {
      const hours = Math.floor(diff / 3_600_000);
      return `${hours}h ago`;
    }
    // Show time
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'error':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'partial':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    }
  }

  onActivityClick(messageId: Id<'chatMessage'> | undefined): void {
    if (messageId) {
      this.messageSelected.emit(messageId);
    }
  }

  isActivitySelected(messageId: Id<'chatMessage'> | undefined): boolean {
    return messageId !== undefined && messageId === this.selectedMessageId();
  }

  getToolIcon(toolName: string): string {
    // Map tool names to icons or return default
    const iconMap: Record<string, string> = {
      getAccountBalance: '💰',
      getTransactions: '📊',
      searchTransactions: '🔍',
      categorizeTransaction: '🏷️',
      getBudget: '📈',
      default: '🔧',
    };
    return iconMap[toolName] || iconMap['default'];
  }
}
