import { AssetClass } from '@prisma/client';

import { RebalancingService } from './rebalancing.service';

describe('RebalancingService', () => {
  describe('computeSuggestions', () => {
    it('returns empty suggestions when no target allocations are provided', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          AAPL: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 10000
          }
        },
        targetAllocations: []
      });

      expect(result.suggestions).toEqual([]);
      expect(result.totalInvestedValueInBaseCurrency).toBe(10000);
    });

    it('computes drift for a balanced portfolio', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          VTI: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 6000
          },
          BND: {
            assetClass: AssetClass.FIXED_INCOME,
            valueInBaseCurrency: 4000
          }
        },
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 0.6 },
          { assetClass: AssetClass.FIXED_INCOME, targetPercentage: 0.4 }
        ]
      });

      expect(result.totalInvestedValueInBaseCurrency).toBe(10000);
      expect(result.suggestions).toHaveLength(2);

      const equity = result.suggestions.find(
        (s) => s.assetClass === AssetClass.EQUITY
      );
      expect(equity.currentPercentage).toBeCloseTo(0.6);
      expect(equity.targetPercentage).toBe(0.6);
      expect(equity.deltaPercentage).toBeCloseTo(0);
      expect(equity.deltaValueInBaseCurrency).toBeCloseTo(0);

      const fixedIncome = result.suggestions.find(
        (s) => s.assetClass === AssetClass.FIXED_INCOME
      );
      expect(fixedIncome.currentPercentage).toBeCloseTo(0.4);
      expect(fixedIncome.deltaPercentage).toBeCloseTo(0);
    });

    it('computes positive drift when equity is overweight', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          VTI: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 8000
          },
          BND: {
            assetClass: AssetClass.FIXED_INCOME,
            valueInBaseCurrency: 2000
          }
        },
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 0.6 },
          { assetClass: AssetClass.FIXED_INCOME, targetPercentage: 0.4 }
        ]
      });

      expect(result.totalInvestedValueInBaseCurrency).toBe(10000);

      const equity = result.suggestions.find(
        (s) => s.assetClass === AssetClass.EQUITY
      );
      // Current 80%, target 60% → sell $2000
      expect(equity.currentPercentage).toBeCloseTo(0.8);
      expect(equity.deltaPercentage).toBeCloseTo(-0.2);
      expect(equity.deltaValueInBaseCurrency).toBeCloseTo(-2000);

      const fixedIncome = result.suggestions.find(
        (s) => s.assetClass === AssetClass.FIXED_INCOME
      );
      // Current 20%, target 40% → buy $2000
      expect(fixedIncome.currentPercentage).toBeCloseTo(0.2);
      expect(fixedIncome.deltaPercentage).toBeCloseTo(0.2);
      expect(fixedIncome.deltaValueInBaseCurrency).toBeCloseTo(2000);
    });

    it('handles asset class with zero current holdings', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          VTI: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 10000
          }
        },
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 0.7 },
          { assetClass: AssetClass.FIXED_INCOME, targetPercentage: 0.3 }
        ]
      });

      const fixedIncome = result.suggestions.find(
        (s) => s.assetClass === AssetClass.FIXED_INCOME
      );
      expect(fixedIncome.currentPercentage).toBe(0);
      expect(fixedIncome.currentValueInBaseCurrency).toBe(0);
      expect(fixedIncome.deltaPercentage).toBeCloseTo(0.3);
      expect(fixedIncome.deltaValueInBaseCurrency).toBeCloseTo(3000);
    });

    it('excludes LIQUIDITY from total invested value', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          VTI: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 6000
          },
          CASH: {
            assetClass: AssetClass.LIQUIDITY,
            valueInBaseCurrency: 4000
          }
        },
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 1.0 }
        ]
      });

      // Only equity counts toward total
      expect(result.totalInvestedValueInBaseCurrency).toBe(6000);

      const equity = result.suggestions.find(
        (s) => s.assetClass === AssetClass.EQUITY
      );
      expect(equity.currentPercentage).toBeCloseTo(1.0);
      expect(equity.deltaPercentage).toBeCloseTo(0);
    });

    it('handles empty holdings with target allocations', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {},
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 0.6 },
          { assetClass: AssetClass.FIXED_INCOME, targetPercentage: 0.4 }
        ]
      });

      expect(result.totalInvestedValueInBaseCurrency).toBe(0);
      expect(result.suggestions).toHaveLength(2);

      for (const suggestion of result.suggestions) {
        expect(suggestion.currentPercentage).toBe(0);
        expect(suggestion.currentValueInBaseCurrency).toBe(0);
        expect(suggestion.deltaValueInBaseCurrency).toBe(0);
      }
    });

    it('aggregates multiple holdings of the same asset class', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          AAPL: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 3000
          },
          MSFT: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 2000
          },
          BND: {
            assetClass: AssetClass.FIXED_INCOME,
            valueInBaseCurrency: 5000
          }
        },
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 0.6 },
          { assetClass: AssetClass.FIXED_INCOME, targetPercentage: 0.4 }
        ]
      });

      expect(result.totalInvestedValueInBaseCurrency).toBe(10000);

      const equity = result.suggestions.find(
        (s) => s.assetClass === AssetClass.EQUITY
      );
      // AAPL + MSFT = 5000 → 50%, target 60% → buy $1000
      expect(equity.currentValueInBaseCurrency).toBe(5000);
      expect(equity.currentPercentage).toBeCloseTo(0.5);
      expect(equity.deltaPercentage).toBeCloseTo(0.1);
      expect(equity.deltaValueInBaseCurrency).toBeCloseTo(1000);
    });

    it('handles holdings with undefined assetClass', () => {
      const result = RebalancingService.computeSuggestions({
        holdings: {
          UNKNOWN: {
            assetClass: undefined,
            valueInBaseCurrency: 1000
          },
          VTI: {
            assetClass: AssetClass.EQUITY,
            valueInBaseCurrency: 9000
          }
        },
        targetAllocations: [
          { assetClass: AssetClass.EQUITY, targetPercentage: 1.0 }
        ]
      });

      // Undefined assetClass is excluded like LIQUIDITY
      expect(result.totalInvestedValueInBaseCurrency).toBe(9000);

      const equity = result.suggestions.find(
        (s) => s.assetClass === AssetClass.EQUITY
      );
      expect(equity.currentPercentage).toBeCloseTo(1.0);
    });
  });
});
