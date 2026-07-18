export interface TaxCsvExportItem {
  acquisitionDate: string;
  disposalDate: string;
  symbol: string;
  currency: string;
  quantity: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  account: string;
  type: string;
}

export interface TaxCsvExportResponse {
  meta: {
    date: string;
    version: string;
  };
  items: TaxCsvExportItem[];
}
