import { AssetClass } from '@prisma/client';

export interface RebalancingSuggestion {
  assetClass: AssetClass;
  currentPercentage: number;
  currentValueInBaseCurrency: number;
  deltaPercentage: number;
  deltaValueInBaseCurrency: number;
  targetPercentage: number;
}

export interface PortfolioRebalancingResponse {
  suggestions: RebalancingSuggestion[];
  totalInvestedValueInBaseCurrency: number;
}
