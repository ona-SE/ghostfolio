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
