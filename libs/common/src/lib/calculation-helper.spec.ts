import { Big } from 'big.js';

import {
  getAnnualizedPerformancePercent,
  getDailyReturns,
  getHoldingOverlap,
  getSharpeRatio,
  getVolatility
} from './calculation-helper';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';

describe('CalculationHelper', () => {
  describe('annualized performance percentage', () => {
    it('Get annualized performance', async () => {
      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: NaN, // differenceInDays of date-fns returns NaN for the same day
          netPerformancePercentage: new Big(0)
        }).toNumber()
      ).toEqual(0);

      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 0,
          netPerformancePercentage: new Big(0)
        }).toNumber()
      ).toEqual(0);

      /**
       * Source: https://www.readyratios.com/reference/analysis/annualized_rate.html
       */
      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 65, // < 1 year
          netPerformancePercentage: new Big(0.1025)
        }).toNumber()
      ).toBeCloseTo(0.729705);

      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 365, // 1 year
          netPerformancePercentage: new Big(0.05)
        }).toNumber()
      ).toBeCloseTo(0.05);

      /**
       * Source: https://www.investopedia.com/terms/a/annualized-total-return.asp#annualized-return-formula-and-calculation
       */
      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 575, // > 1 year
          netPerformancePercentage: new Big(0.2374)
        }).toNumber()
      ).toBeCloseTo(0.145);
    });
  });

  describe('getDailyReturns', () => {
    it('should return empty array for single data point', () => {
      const chart: HistoricalDataItem[] = [
        { date: '2024-01-01', netWorth: 1000 }
      ];
      expect(getDailyReturns(chart)).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      expect(getDailyReturns([])).toEqual([]);
    });

    it('should compute correct daily returns', () => {
      const chart: HistoricalDataItem[] = [
        { date: '2024-01-01', netWorth: 1000 },
        { date: '2024-01-02', netWorth: 1050 },
        { date: '2024-01-03', netWorth: 1020 }
      ];
      const returns = getDailyReturns(chart);
      expect(returns).toHaveLength(2);
      expect(returns[0]).toBeCloseTo(0.05); // +5%
      expect(returns[1]).toBeCloseTo(-0.02857, 4); // -2.857%
    });

    it('should skip entries where previous netWorth is 0', () => {
      const chart: HistoricalDataItem[] = [
        { date: '2024-01-01', netWorth: 0 },
        { date: '2024-01-02', netWorth: 1000 },
        { date: '2024-01-03', netWorth: 1100 }
      ];
      const returns = getDailyReturns(chart);
      expect(returns).toHaveLength(1);
      expect(returns[0]).toBeCloseTo(0.1);
    });
  });

  describe('getVolatility', () => {
    it('should return 0 for fewer than 2 data points', () => {
      expect(getVolatility([])).toEqual(0);
      expect(getVolatility([0.01])).toEqual(0);
    });

    it('should return 0 for constant returns', () => {
      // All returns identical → std dev = 0
      expect(getVolatility([0.01, 0.01, 0.01, 0.01])).toEqual(0);
    });

    it('should compute annualized volatility', () => {
      // Known daily returns with std dev ≈ 0.01
      const dailyReturns = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
      const vol = getVolatility(dailyReturns);

      // Daily std dev of alternating +1%/-1% with mean 0:
      // variance = (6 * 0.0001) / 5 = 0.00012, std = 0.01095
      // Annualized = 0.01095 * sqrt(252) ≈ 0.1738
      expect(vol).toBeCloseTo(0.1738, 2);
    });
  });

  describe('getSharpeRatio', () => {
    it('should return 0 when volatility is 0', () => {
      expect(getSharpeRatio({ annualizedReturn: 0.1, volatility: 0 })).toEqual(
        0
      );
    });

    it('should compute Sharpe ratio with default risk-free rate', () => {
      // (0.10 - 0) / 0.15 = 0.6667
      expect(
        getSharpeRatio({ annualizedReturn: 0.1, volatility: 0.15 })
      ).toBeCloseTo(0.6667, 3);
    });

    it('should compute Sharpe ratio with custom risk-free rate', () => {
      // (0.10 - 0.02) / 0.15 = 0.5333
      expect(
        getSharpeRatio({
          annualizedReturn: 0.1,
          riskFreeRate: 0.02,
          volatility: 0.15
        })
      ).toBeCloseTo(0.5333, 3);
    });
  });

  describe('getHoldingOverlap', () => {
    it('should return empty object when no overlap', () => {
      const result = getHoldingOverlap([
        { accountId: 'a1', symbols: ['AAPL', 'MSFT'] },
        { accountId: 'a2', symbols: ['GOOGL', 'AMZN'] }
      ]);
      expect(result).toEqual({});
    });

    it('should detect overlapping symbols', () => {
      const result = getHoldingOverlap([
        { accountId: 'a1', symbols: ['AAPL', 'MSFT', 'GOOGL'] },
        { accountId: 'a2', symbols: ['GOOGL', 'AMZN'] },
        { accountId: 'a3', symbols: ['AAPL', 'TSLA'] }
      ]);
      expect(result).toEqual({
        AAPL: ['a1', 'a3'],
        GOOGL: ['a1', 'a2']
      });
    });

    it('should return empty object for empty input', () => {
      expect(getHoldingOverlap([])).toEqual({});
    });
  });
});
