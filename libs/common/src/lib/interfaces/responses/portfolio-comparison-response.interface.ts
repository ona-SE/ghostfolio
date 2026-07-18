import { HistoricalDataItem } from '../historical-data-item.interface';
import { ResponseError } from './errors.interface';

export interface PortfolioComparisonAccount {
  accountId: string;
  accountName: string;
  chart: HistoricalDataItem[];
  metrics: {
    annualizedReturn: number;
    currentValue: number;
    netPerformance: number;
    netPerformancePercentage: number;
    sharpeRatio: number;
    totalInvestment: number;
    volatility: number;
  };
  symbols: string[];
}

export interface PortfolioComparisonResponse extends ResponseError {
  accounts: PortfolioComparisonAccount[];
  holdingOverlap: Record<string, string[]>;
}
