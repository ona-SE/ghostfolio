import {
  getTooltipOptions,
  getVerticalHoverLinePlugin,
  transformTickToAbbreviation
} from '@ghostfolio/common/chart-helper';
import {
  benchmarkColorRgb,
  primaryColorRgb,
  secondaryColorRgb
} from '@ghostfolio/common/config';
import {
  getBackgroundColor,
  getDateFormatString,
  getLocale,
  getTextColor,
  parseDate
} from '@ghostfolio/common/helper';
import {
  HistoricalDataItem,
  LineChartItem
} from '@ghostfolio/common/interfaces';
import { InvestmentItem } from '@ghostfolio/common/interfaces/investment-item.interface';
import { ColorScheme, GroupBy } from '@ghostfolio/common/types';
import { registerChartConfiguration } from '@ghostfolio/ui/chart';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { SymbolProfile } from '@prisma/client';
import {
  BarController,
  BarElement,
  Chart,
  ChartData,
  ChartDataset,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  type ScriptableLineSegmentContext,
  TimeScale,
  Tooltip,
  type TooltipOptions
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin, {
  type AnnotationOptions
} from 'chartjs-plugin-annotation';
import { isAfter } from 'date-fns';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import { alignBenchmarkToPortfolioDates } from './benchmark-chart.helper';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatSelectModule,
    NgxSkeletonLoaderModule
  ],
  selector: 'gf-investment-chart',
  styleUrls: ['./investment-chart.component.scss'],
  templateUrl: './investment-chart.component.html'
})
export class GfInvestmentChartComponent implements OnChanges, OnDestroy {
  @Input() benchmark: Partial<SymbolProfile>;
  @Input() benchmarkDataItems: InvestmentItem[] = [];
  @Input() benchmarkDataLabel = '';
  @Input() benchmarkPerformanceDataItems: HistoricalDataItem[] = [];
  @Input() benchmarks: Partial<SymbolProfile>[];
  @Input() colorScheme: ColorScheme;
  @Input() currency: string;
  @Input() groupBy: GroupBy;
  @Input() historicalDataItems: LineChartItem[] = [];
  @Input() isInPercentage = false;
  @Input() isLoading = false;
  @Input() locale = getLocale();
  @Input() savingsRate = 0;

  @Output() benchmarkChanged = new EventEmitter<string>();

  @ViewChild('chartCanvas') chartCanvas: ElementRef<HTMLCanvasElement>;

  public chart: Chart<'bar' | 'line'>;
  public hasBenchmarkSelector = false;
  private investments: InvestmentItem[];
  private values: LineChartItem[];

  public constructor() {
    Chart.register(
      annotationPlugin,
      BarController,
      BarElement,
      LinearScale,
      LineController,
      LineElement,
      PointElement,
      TimeScale,
      Tooltip
    );

    registerChartConfiguration();
  }

  public ngOnChanges() {
    this.hasBenchmarkSelector = this.benchmarks?.length > 0 && !this.groupBy;

    if (this.benchmarkDataItems && this.historicalDataItems) {
      this.initialize();
    }
  }

  public ngOnDestroy() {
    this.chart?.destroy();
  }

  public onChangeBenchmark(symbolProfileId: string) {
    this.benchmarkChanged.next(symbolProfileId);
  }

  private initialize() {
    // Create clones
    this.investments = this.benchmarkDataItems.map((item) =>
      Object.assign({}, item)
    );
    this.values = this.historicalDataItems.map((item) =>
      Object.assign({}, item)
    );

    const datasets: ChartDataset<'bar' | 'line'>[] = [
      {
        backgroundColor: `rgb(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b})`,
        borderColor: `rgb(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b})`,
        borderWidth: this.groupBy ? 0 : 1,
        data: this.investments.map(({ date, investment }) => {
          return {
            x: parseDate(date).getTime(),
            y: this.isInPercentage ? investment * 100 : investment
          };
        }),
        label: this.benchmarkDataLabel,
        segment: {
          borderColor: (context) =>
            this.isInFuture(
              context,
              `rgba(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b}, 0.67)`
            ),
          borderDash: (context) => this.isInFuture(context, [2, 2])
        },
        stepped: true
      },
      {
        borderColor: `rgb(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b})`,
        borderWidth: 2,
        data: this.values.map(({ date, value }) => {
          return {
            x: parseDate(date).getTime(),
            y: this.isInPercentage ? value * 100 : value
          };
        }),
        fill: false,
        label: $localize`Total Amount`,
        pointRadius: 0,
        segment: {
          borderColor: (context) =>
            this.isInFuture(
              context,
              `rgba(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b}, 0.67)`
            ),
          borderDash: (context) => this.isInFuture(context, [2, 2])
        }
      }
    ];

    // Add benchmark performance overlay when data is available
    if (this.benchmarkPerformanceDataItems?.length > 0 && !this.groupBy) {
      const benchmarkLabel = this.benchmark?.name ?? $localize`Benchmark`;

      // Align benchmark data to the same date axis as the portfolio values
      const benchmarkAligned = alignBenchmarkToPortfolioDates({
        parseDate,
        benchmarkPerformanceDataItems: this.benchmarkPerformanceDataItems,
        isInPercentage: this.isInPercentage,
        portfolioDataItems: this.values
      });

      datasets.push({
        borderColor: `rgb(${benchmarkColorRgb.r}, ${benchmarkColorRgb.g}, ${benchmarkColorRgb.b})`,
        borderDash: [4, 2],
        borderWidth: 2,
        data: benchmarkAligned,
        fill: false,
        label: benchmarkLabel,
        pointRadius: 0,
        spanGaps: true
      });
    }

    const chartData: ChartData<'bar' | 'line'> = {
      labels: this.historicalDataItems.map(({ date }) => {
        return parseDate(date);
      }),
      datasets
    };

    if (this.chartCanvas) {
      if (this.chart) {
        this.chart.data = chartData;
        this.chart.options.plugins ??= {};
        this.chart.options.plugins.tooltip =
          this.getTooltipPluginConfiguration();

        const annotations = this.chart.options.plugins.annotation
          .annotations as Record<string, AnnotationOptions<'line'>>;
        if (this.savingsRate && annotations.savingsRate) {
          annotations.savingsRate.value = this.savingsRate;
        }

        this.chart.update();
      } else {
        this.chart = new Chart(this.chartCanvas.nativeElement, {
          data: chartData,
          options: {
            animation: false,
            elements: {
              line: {
                tension: 0
              },
              point: {
                hoverBackgroundColor: getBackgroundColor(this.colorScheme),
                hoverRadius: 2,
                radius: 0
              }
            },
            interaction: { intersect: false, mode: 'index' },
            maintainAspectRatio: true,
            plugins: {
              annotation: {
                annotations: {
                  savingsRate: this.savingsRate
                    ? {
                        borderColor: `rgba(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b}, 0.75)`,
                        borderWidth: 1,
                        label: {
                          backgroundColor: `rgb(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b})`,
                          borderRadius: 2,
                          color: 'white',
                          content: $localize`Savings Rate`,
                          display: true,
                          font: { size: 10, weight: 'normal' },
                          padding: {
                            x: 4,
                            y: 2
                          },
                          position: 'start'
                        },
                        scaleID: 'y',
                        type: 'line',
                        value: this.savingsRate
                      }
                    : undefined,
                  yAxis: {
                    borderColor: `rgba(${getTextColor(this.colorScheme)}, 0.1)`,
                    borderWidth: 1,
                    scaleID: 'y',
                    type: 'line',
                    value: 0
                  }
                }
              },
              legend: {
                display: false
              },
              tooltip: this.getTooltipPluginConfiguration(),
              verticalHoverLine: {
                color: `rgba(${getTextColor(this.colorScheme)}, 0.1)`
              }
            },
            responsive: true,
            scales: {
              x: {
                border: {
                  color: `rgba(${getTextColor(this.colorScheme)}, 0.1)`,
                  width: this.groupBy ? 0 : 1
                },
                display: true,
                grid: {
                  display: false
                },
                type: 'time',
                time: {
                  tooltipFormat: getDateFormatString(this.locale),
                  unit: 'year'
                }
              },
              y: {
                border: {
                  display: false
                },
                display: !this.isInPercentage,
                grid: {
                  color: ({ scale, tick }) => {
                    if (
                      tick.value === 0 ||
                      tick.value === scale.max ||
                      tick.value === scale.min
                    ) {
                      return `rgba(${getTextColor(this.colorScheme)}, 0.1)`;
                    }

                    return 'transparent';
                  }
                },
                position: 'right',
                ticks: {
                  callback: (value: number) => {
                    return transformTickToAbbreviation(value);
                  },
                  display: true,
                  mirror: true,
                  z: 1
                }
              }
            }
          },
          plugins: [
            getVerticalHoverLinePlugin(this.chartCanvas, this.colorScheme)
          ],
          type: this.groupBy ? 'bar' : 'line'
        });
      }
    }
  }

  private getTooltipPluginConfiguration(): Partial<
    TooltipOptions<'bar' | 'line'>
  > {
    return {
      ...getTooltipOptions({
        colorScheme: this.colorScheme,
        currency: this.isInPercentage ? undefined : this.currency,
        groupBy: this.groupBy,
        locale: this.isInPercentage ? undefined : this.locale,
        unit: this.isInPercentage ? '%' : undefined
      }),
      mode: 'index',
      position: 'top',
      xAlign: 'center',
      yAlign: 'bottom'
    };
  }

  private isInFuture<T>(aContext: ScriptableLineSegmentContext, aValue: T) {
    return isAfter(new Date(aContext?.p1?.parsed?.x), new Date())
      ? aValue
      : undefined;
  }
}
