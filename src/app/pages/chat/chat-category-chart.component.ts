import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConvexService } from '../../services/convex.service';
import { api } from '../../../../convex/_generated/api';
import { FunctionReturnType } from 'convex/server';
import { HlmSkeleton } from '../../lib/ui/ui-skeleton-helm/src';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

type CategorySummary = FunctionReturnType<
  typeof api.categoryAggregation.getCategorySummary
>[number];

@Component({
  selector: 'app-chat-category-chart',
  imports: [CommonModule, HlmSkeleton],
  template: `
    <div class="my-4 overflow-hidden rounded-lg border border-border bg-card">
      @if (loading()) {
        <div class="p-4">
          <hlm-skeleton class="h-8 w-48 mb-4" />
          @if (chartType() === 'table') {
            <div class="space-y-2">
              @for (_ of skeletonArray(); track $index) {
                <hlm-skeleton class="h-12 w-full" />
              }
            </div>
          } @else {
            <hlm-skeleton class="mx-auto h-[300px] w-[300px]" />
          }
        </div>
      } @else if (error()) {
        <div class="p-4 text-sm text-destructive">
          {{ error() }}
        </div>
      } @else if (categories().length === 0) {
        <div class="p-4 text-sm text-muted-foreground">No category data found</div>
      } @else {
        <div class="p-4">
          <h3 class="mb-4 text-lg font-semibold">
            {{ getTitle() }}
          </h3>

          @if (chartType() === 'table') {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="border-b border-border bg-muted">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Category</th>
                    <th class="px-4 py-3 text-right font-medium">Total Amount</th>
                    <th class="px-4 py-3 text-right font-medium">Transactions</th>
                    <th class="px-4 py-3 text-right font-medium">Percentage</th>
                    <th class="px-4 py-3 text-right font-medium">Avg / Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  @for (category of categories(); track category.categoryId) {
                    <tr class="border-b border-border last:border-0 hover:bg-muted/50">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <div
                            class="h-3 w-3 rounded-full"
                            [style.backgroundColor]="getCategoryColor($index)"
                          ></div>
                          <span class="font-medium">{{ category.categoryName }}</span>
                          @if (category.groupName) {
                            <span class="text-xs text-muted-foreground"
                              >({{ category.groupName }})</span
                            >
                          }
                        </div>
                      </td>
                      <td class="px-4 py-3 text-right font-medium">
                        {{ formatCurrency(category.totalAmount) }}
                      </td>
                      <td class="px-4 py-3 text-right text-muted-foreground">
                        {{ category.transactionCount }}
                      </td>
                      <td class="px-4 py-3 text-right text-muted-foreground">
                        {{ formatPercentage(category.percentage) }}
                      </td>
                      <td class="px-4 py-3 text-right text-muted-foreground">
                        {{ formatCurrency(category.averagePerTransaction) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="flex justify-center">
              <div class="relative h-[400px] w-full max-w-[600px]">
                <canvas #chartCanvas></canvas>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
              @for (category of categories(); track category.categoryId) {
                <div class="flex items-center gap-2">
                  <div
                    class="h-3 w-3 flex-shrink-0 rounded-full"
                    [style.backgroundColor]="getCategoryColor($index)"
                  ></div>
                  <span class="truncate">{{ category.categoryName }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatCategoryChartComponent {
  private readonly convexService = inject(ConvexService);

  readonly categoryIds = input.required<string[]>();
  readonly chartType = input.required<'pie' | 'bar' | 'table'>();
  readonly startDate = input<string | undefined>(undefined);
  readonly endDate = input<string | undefined>(undefined);
  readonly transactionType = input<'income' | 'expense' | 'transfer' | 'all' | undefined>(
    undefined,
  );

  private readonly _categories = signal<CategorySummary[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _loadedCacheKey: string | null = null;
  private _chartInstance: Chart | null = null;

  readonly categories = this._categories.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly skeletonArray = computed(() => Array(this.categoryIds().length).fill(null));

  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  // Color palette for categories
  private readonly colorPalette = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#6366f1', // indigo
  ];

  constructor() {
    console.log('[CategoryChart] Constructor called');

    effect(() => {
      const ids = this.categoryIds();
      const type = this.chartType();
      const start = this.startDate();
      const end = this.endDate();
      const txType = this.transactionType();

      console.log('[CategoryChart] Effect triggered', {
        idsLength: ids.length,
        type,
        start,
        end,
        txType,
      });

      if (ids.length > 0) {
        const cacheKey = `${ids.slice().sort().join(',')}-${type}-${start}-${end}-${txType}`;

        console.log('[CategoryChart] Cache key comparison', {
          newCacheKey: cacheKey,
          loadedCacheKey: this._loadedCacheKey,
          shouldLoad: cacheKey !== this._loadedCacheKey,
        });

        if (cacheKey !== this._loadedCacheKey) {
          this.loadCategories(ids, cacheKey);
        } else {
          console.log('[CategoryChart] Skipping load - data already cached');
        }
      } else {
        console.warn('[CategoryChart] No category IDs provided');
      }
    });

    // Effect to render chart when canvas becomes available and we have data
    effect(() => {
      const canvas = this.chartCanvas();
      const categories = this.categories();
      const type = this.chartType();

      console.log('[CategoryChart] Render effect triggered', {
        hasCanvas: !!canvas,
        categoriesLength: categories.length,
        chartType: type,
      });

      if (canvas && categories.length > 0 && type !== 'table') {
        console.log('[CategoryChart] Triggering chart render from effect');
        this.renderChart();
      }
    });
  }

  private async loadCategories(ids: string[], cacheKey: string) {
    console.log('[CategoryChart] loadCategories called', {
      ids,
      cacheKey,
      startDate: this.startDate(),
      endDate: this.endDate(),
      transactionType: this.transactionType(),
      chartType: this.chartType(),
    });

    this._loading.set(true);
    this._error.set(null);

    try {
      const client = this.convexService.getClient();
      const result = await client.query(api.categoryAggregation.getCategorySummary, {
        categoryIds: ids,
        startDate: this.startDate(),
        endDate: this.endDate(),
        transactionType: this.transactionType(),
      });

      console.log('[CategoryChart] Data loaded from Convex:', result);

      this._categories.set(result);
      this._loadedCacheKey = cacheKey;
    } catch (error) {
      console.error('[CategoryChart] Error loading category data:', error);
      this._error.set('Failed to load category data');
    } finally {
      this._loading.set(false);
    }
  }

  private renderChart(): void {
    console.log('[CategoryChart] renderChart called', {
      chartType: this.chartType(),
      categoriesLength: this.categories().length,
    });

    if (this.chartType() === 'table') {
      console.log('[CategoryChart] Skipping chart render - table mode');
      return;
    }

    const canvas = this.chartCanvas()?.nativeElement;
    console.log('[CategoryChart] Canvas element:', {
      canvas,
      exists: !!canvas,
      width: canvas?.width,
      height: canvas?.height,
      clientWidth: canvas?.clientWidth,
      clientHeight: canvas?.clientHeight,
    });

    if (!canvas || this.categories().length === 0) {
      console.warn('[CategoryChart] Cannot render chart - missing canvas or no data', {
        hasCanvas: !!canvas,
        categoriesLength: this.categories().length,
      });
      return;
    }

    // Destroy existing chart if any
    if (this._chartInstance) {
      console.log('[CategoryChart] Destroying existing chart instance');
      this._chartInstance.destroy();
      this._chartInstance = null;
    }

    const categories = this.categories();
    const labels = categories.map((c) => c.categoryName);
    const data = categories.map((c) => c.totalAmount / 100); // Convert cents to dollars
    const colors = categories.map((_, i) => this.getCategoryColor(i));

    console.log('[CategoryChart] Chart data prepared:', {
      labels,
      data,
      colors,
      chartType: this.chartType(),
    });

    let config: ChartConfiguration;

    if (this.chartType() === 'pie') {
      config = {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                },
              },
            },
          },
        },
      };
    } else {
      // bar chart
      config = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Amount',
              data,
              backgroundColor: colors,
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y;
                  return `Amount: $${value !== null ? value.toFixed(2) : '0.00'}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `$${value}`,
              },
            },
          },
        },
      };
    }

    console.log('[CategoryChart] Creating Chart.js instance with config:', config);

    try {
      this._chartInstance = new Chart(canvas, config);
      console.log('[CategoryChart] Chart instance created successfully:', this._chartInstance);
    } catch (error) {
      console.error('[CategoryChart] Error creating chart instance:', error);
      throw error;
    }
  }

  getCategoryColor(index: number): string {
    return this.colorPalette[index % this.colorPalette.length];
  }

  getTitle(): string {
    const typeText =
      this.transactionType() && this.transactionType() !== 'all'
        ? ` (${this.transactionType()?.charAt(0).toUpperCase()}${this.transactionType()?.slice(1)})`
        : '';
    return `Category Breakdown${typeText}`;
  }

  formatCurrency(amount: number): string {
    const dollars = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  }

  formatPercentage(percentage: number): string {
    return `${percentage.toFixed(1)}%`;
  }
}
