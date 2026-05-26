import { Big } from 'big.js';
import {
  endOfDay,
  endOfYear,
  max,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subYears
} from 'date-fns';
import { isFinite, isNumber } from 'lodash';

import { resetHours } from './helper';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';
import { DateRange } from './types';

export function getAnnualizedPerformancePercent({
  daysInMarket,
  netPerformancePercentage
}: {
  daysInMarket: number;
  netPerformancePercentage: Big;
}): Big {
  if (isNumber(daysInMarket) && daysInMarket > 0) {
    const exponent = new Big(365).div(daysInMarket).toNumber();
    const growthFactor = Math.pow(
      netPerformancePercentage.plus(1).toNumber(),
      exponent
    );

    if (isFinite(growthFactor)) {
      return new Big(growthFactor).minus(1);
    }
  }

  return new Big(0);
}

export function getIntervalFromDateRange(params: {
  dateRange: DateRange;
  endDate?: Date;
  startDate?: Date;
}) {
  const { dateRange } = params;
  let endDate = params.endDate ?? endOfDay(new Date());
  let startDate = params.startDate ?? new Date(0);

  switch (dateRange) {
    case '1d':
      startDate = max([startDate, subDays(resetHours(new Date()), 1)]);
      break;
    case 'mtd':
      startDate = max([
        startDate,
        subDays(startOfMonth(resetHours(new Date())), 1)
      ]);
      break;
    case 'wtd':
      startDate = max([
        startDate,
        subDays(startOfWeek(resetHours(new Date()), { weekStartsOn: 1 }), 1)
      ]);
      break;
    case 'ytd':
      startDate = max([
        startDate,
        subDays(startOfYear(resetHours(new Date())), 1)
      ]);
      break;
    case '1y':
      startDate = max([startDate, subYears(resetHours(new Date()), 1)]);
      break;
    case '5y':
      startDate = max([startDate, subYears(resetHours(new Date()), 5)]);
      break;
    case 'max':
      break;
    default:
      // '2024', '2023', '2022', etc.
      endDate = endOfYear(new Date(dateRange));
      startDate = max([startDate, new Date(dateRange)]);
  }

  return { endDate, startDate };
}

/**
 * Computes daily returns from a time series of net worth values.
 * Returns an array of fractional daily returns (e.g. 0.02 = +2%).
 */
export function getDailyReturns(chartData: HistoricalDataItem[]): number[] {
  const returns: number[] = [];

  for (let i = 1; i < chartData.length; i++) {
    const previous = chartData[i - 1].netWorth ?? 0;
    const current = chartData[i].netWorth ?? 0;

    if (previous > 0) {
      returns.push((current - previous) / previous);
    }
  }

  return returns;
}

/**
 * Annualized volatility: standard deviation of daily returns × √252.
 * Returns 0 when fewer than 2 data points are available.
 */
export function getVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) {
    return 0;
  }

  const mean =
    dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  const variance =
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    (dailyReturns.length - 1);

  const dailyStdDev = Math.sqrt(variance);

  // Annualize: multiply by √252 (trading days per year)
  return dailyStdDev * Math.sqrt(252);
}

/**
 * Sharpe ratio: (annualized return − risk-free rate) / annualized volatility.
 * Uses 0 as the default risk-free rate.
 * Returns 0 when volatility is 0 or data is insufficient.
 */
export function getSharpeRatio({
  annualizedReturn,
  riskFreeRate = 0,
  volatility
}: {
  annualizedReturn: number;
  riskFreeRate?: number;
  volatility: number;
}): number {
  if (volatility === 0 || !isFinite(volatility)) {
    return 0;
  }

  return (annualizedReturn - riskFreeRate) / volatility;
}

/**
 * Computes the set of symbols that appear in multiple accounts.
 * Returns a map of symbol → list of account IDs that hold it.
 */
export function getHoldingOverlap(
  accountHoldings: { accountId: string; symbols: string[] }[]
): Record<string, string[]> {
  const symbolToAccounts: Record<string, string[]> = {};

  for (const { accountId, symbols } of accountHoldings) {
    for (const symbol of symbols) {
      if (!symbolToAccounts[symbol]) {
        symbolToAccounts[symbol] = [];
      }
      symbolToAccounts[symbol].push(accountId);
    }
  }

  // Only return symbols held in more than one account
  const overlap: Record<string, string[]> = {};

  for (const [symbol, accounts] of Object.entries(symbolToAccounts)) {
    if (accounts.length > 1) {
      overlap[symbol] = accounts;
    }
  }

  return overlap;
}
