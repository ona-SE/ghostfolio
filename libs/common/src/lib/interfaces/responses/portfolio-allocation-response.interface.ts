export interface PortfolioAllocationResponse {
  byAssetClass: {
    [assetClass: string]: {
      name: string;
      allocationInPercentage: number;
      valueInBaseCurrency: number;
    };
  };
  bySector: {
    [sector: string]: {
      name: string;
      allocationInPercentage: number;
      valueInBaseCurrency: number;
    };
  };
  byGeography: {
    [countryCode: string]: {
      name: string;
      allocationInPercentage: number;
      valueInBaseCurrency: number;
    };
  };
}
