export type CostBasisMethod = 'FIFO' | 'LIFO';

export interface TaxReportItem {
  acquisitionDate: string;
  disposalDate: string;
  symbol: string;
  currency: string;
  quantity: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  holdingPeriodInDays: number;
  isLongTerm: boolean;
  account: string;
  type: string;
}

export interface TaxReportResponse {
  meta: {
    costBasisMethod: CostBasisMethod;
    date: string;
    version: string;
    baseCurrency: string;
    taxYear: number;
  };
  items: TaxReportItem[];
  summary: {
    totalGainLoss: number;
    shortTermGainLoss: number;
    longTermGainLoss: number;
  };
}

export interface UnrealizedLot {
  acquisitionDate: string;
  symbol: string;
  currency: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  unrealizedGainLoss: number;
  holdingPeriodInDays: number;
  isLongTerm: boolean;
  account: string;
}

export interface UnrealizedLotsResponse {
  meta: {
    costBasisMethod: CostBasisMethod;
    date: string;
    baseCurrency: string;
  };
  lots: UnrealizedLot[];
  summary: {
    totalUnrealizedGainLoss: number;
    shortTermUnrealizedGainLoss: number;
    longTermUnrealizedGainLoss: number;
  };
}

export interface SimulateSellResponse {
  meta: {
    costBasisMethod: CostBasisMethod;
    date: string;
    baseCurrency: string;
    symbol: string;
    quantityToSell: number;
    sellPrice: number;
  };
  lots: {
    acquisitionDate: string;
    quantity: number;
    costBasis: number;
    proceeds: number;
    gainLoss: number;
    holdingPeriodInDays: number;
    isLongTerm: boolean;
  }[];
  summary: {
    totalProceeds: number;
    totalCostBasis: number;
    totalGainLoss: number;
    shortTermGainLoss: number;
    longTermGainLoss: number;
  };
}
