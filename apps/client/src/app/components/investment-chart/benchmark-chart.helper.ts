import { HistoricalDataItem } from '@ghostfolio/common/interfaces';

export interface AlignedBenchmarkPoint {
  x: number;
  y: number | null;
}

/**
 * Aligns benchmark performance data to the portfolio value date axis so the
 * benchmark line can be overlaid on the portfolio performance chart (GHOS-44).
 *
 * The benchmark and the portfolio series do not necessarily share the same set
 * of dates (e.g. the benchmark has no data on a day the portfolio does). For
 * every portfolio date we emit a point at that date's timestamp, using the
 * benchmark value when one exists and `null` otherwise. `null` values create a
 * gap that Chart.js bridges via `spanGaps`, which keeps the two lines on the
 * same axis instead of drawing the benchmark on its own, shifted axis.
 *
 * When `isInPercentage` is set the benchmark values are scaled by 100 to match
 * the percentage rendering used by the rest of the chart.
 */
export function alignBenchmarkToPortfolioDates({
  benchmarkPerformanceDataItems,
  isInPercentage = false,
  parseDate,
  portfolioDataItems
}: {
  benchmarkPerformanceDataItems: HistoricalDataItem[];
  isInPercentage?: boolean;
  parseDate: (date: string) => Date;
  portfolioDataItems: { date: string }[];
}): AlignedBenchmarkPoint[] {
  const benchmarkByDate = new Map<string, number>();

  for (const { date, value } of benchmarkPerformanceDataItems ?? []) {
    if (value != null) {
      benchmarkByDate.set(date, value);
    }
  }

  return (portfolioDataItems ?? []).map(({ date }) => {
    const benchmarkValue = benchmarkByDate.get(date);

    return {
      x: parseDate(date).getTime(),
      y:
        benchmarkValue != null
          ? isInPercentage
            ? benchmarkValue * 100
            : benchmarkValue
          : null
    };
  });
}
