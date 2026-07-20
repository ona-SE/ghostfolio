import { alignBenchmarkToPortfolioDates } from './benchmark-chart.helper';

const parseDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

describe('alignBenchmarkToPortfolioDates', () => {
  it('should align matching dates to the portfolio axis', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 110 }
      ],
      portfolioDataItems: [{ date: '2024-01-01' }, { date: '2024-01-02' }]
    });

    expect(result).toEqual([
      { x: parseDate('2024-01-01').getTime(), y: 100 },
      { x: parseDate('2024-01-02').getTime(), y: 110 }
    ]);
  });

  it('should emit null for portfolio dates without a benchmark value', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [{ date: '2024-01-01', value: 100 }],
      portfolioDataItems: [
        { date: '2024-01-01' },
        { date: '2024-01-02' },
        { date: '2024-01-03' }
      ]
    });

    expect(result.map(({ y }) => y)).toEqual([100, null, null]);
  });

  it('should keep one point per portfolio date and drop benchmark-only dates', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 110 },
        { date: '2024-01-03', value: 120 }
      ],
      portfolioDataItems: [{ date: '2024-01-01' }, { date: '2024-01-03' }]
    });

    expect(result).toEqual([
      { x: parseDate('2024-01-01').getTime(), y: 100 },
      { x: parseDate('2024-01-03').getTime(), y: 120 }
    ]);
  });

  it('should scale benchmark values by 100 when rendering in percentage', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [{ date: '2024-01-01', value: 0.05 }],
      isInPercentage: true,
      portfolioDataItems: [{ date: '2024-01-01' }]
    });

    expect(result[0].y).toBeCloseTo(5, 10);
  });

  it('should treat a zero benchmark value as present, not missing', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [{ date: '2024-01-01', value: 0 }],
      portfolioDataItems: [{ date: '2024-01-01' }]
    });

    expect(result[0].y).toBe(0);
  });

  it('should ignore null benchmark values and treat those dates as gaps', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [
        { date: '2024-01-01', value: null },
        { date: '2024-01-02', value: 110 }
      ],
      portfolioDataItems: [{ date: '2024-01-01' }, { date: '2024-01-02' }]
    });

    expect(result.map(({ y }) => y)).toEqual([null, 110]);
  });

  it('should return an empty array when there are no portfolio dates', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [{ date: '2024-01-01', value: 100 }],
      portfolioDataItems: []
    });

    expect(result).toEqual([]);
  });

  it('should emit all-null points when the benchmark series is empty', () => {
    const result = alignBenchmarkToPortfolioDates({
      parseDate,
      benchmarkPerformanceDataItems: [],
      portfolioDataItems: [{ date: '2024-01-01' }, { date: '2024-01-02' }]
    });

    expect(result.map(({ y }) => y)).toEqual([null, null]);
  });
});
