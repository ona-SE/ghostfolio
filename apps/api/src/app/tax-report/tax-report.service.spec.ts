import { TaxReportService } from './tax-report.service';

describe('TaxReportService', () => {
  describe('computeTaxReportItems', () => {
    const accountMap = new Map([
      ['acc-1', 'Main Brokerage'],
      ['acc-2', 'Retirement']
    ]);

    // Tax year 2024
    const startDate = new Date('2024-01-01T00:00:00.000Z');
    const endDate = new Date('2024-12-31T23:59:59.999Z');

    function makeActivity(overrides: {
      accountId?: string;
      currency?: string;
      date: string;
      fee?: number;
      quantity: number;
      symbol: string;
      type: string;
      unitPrice: number;
    }) {
      return {
        accountId: overrides.accountId ?? 'acc-1',
        currency: overrides.currency ?? undefined,
        date: new Date(overrides.date),
        fee: overrides.fee ?? 0,
        quantity: overrides.quantity,
        SymbolProfile: {
          currency: overrides.currency ?? 'USD',
          symbol: overrides.symbol
        },
        type: overrides.type,
        unitPrice: overrides.unitPrice
      };
    }

    it('should match a simple BUY then SELL with holding period', () => {
      const activities = [
        makeActivity({
          date: '2024-01-15',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 5
        }),
        makeActivity({
          date: '2024-06-15',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 180,
          fee: 5
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(1);
      expect(items[0].symbol).toBe('AAPL');
      expect(items[0].type).toBe('SELL');
      expect(items[0].quantity).toBe(10);
      expect(items[0].costBasis).toBe(1505);
      expect(items[0].proceeds).toBe(1795);
      expect(items[0].gainLoss).toBe(290);
      expect(items[0].account).toBe('Main Brokerage');

      // Jan 15 to Jun 15 = 152 days
      expect(items[0].holdingPeriodInDays).toBe(152);
      expect(items[0].isLongTerm).toBe(false);
    });

    it('should classify holdings over 365 days as long-term', () => {
      const activities = [
        makeActivity({
          date: '2023-01-01',
          type: 'BUY',
          symbol: 'MSFT',
          quantity: 5,
          unitPrice: 250,
          fee: 0
        }),
        makeActivity({
          date: '2024-03-01',
          type: 'SELL',
          symbol: 'MSFT',
          quantity: 5,
          unitPrice: 400,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(1);
      expect(items[0].isLongTerm).toBe(true);
      expect(items[0].holdingPeriodInDays).toBeGreaterThanOrEqual(365);
      expect(items[0].gainLoss).toBe(750); // (400-250)*5
    });

    it('should handle partial lot matching (FIFO) with holding periods', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 300,
          fee: 10
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 320,
          fee: 10
        }),
        makeActivity({
          date: '2024-07-10',
          type: 'SELL',
          symbol: 'GOOG',
          quantity: 7,
          unitPrice: 350,
          fee: 14
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(2);

      // First lot: 5 from first buy (Jan 10 -> Jul 10 = 182 days)
      expect(items[0].quantity).toBe(5);
      expect(items[0].holdingPeriodInDays).toBe(182);
      expect(items[0].isLongTerm).toBe(false);
      expect(items[0].costBasis).toBe(1510);
      expect(items[0].proceeds).toBe(1740);

      // Second lot: 2 from second buy (Mar 10 -> Jul 10 = 122 days)
      expect(items[1].quantity).toBe(2);
      expect(items[1].holdingPeriodInDays).toBe(122);
      expect(items[1].isLongTerm).toBe(false);
    });

    it('should handle dividends within the tax year', () => {
      const activities = [
        makeActivity({
          date: '2024-01-15',
          type: 'BUY',
          symbol: 'VTI',
          quantity: 100,
          unitPrice: 200,
          fee: 0
        }),
        makeActivity({
          date: '2024-03-15',
          type: 'DIVIDEND',
          symbol: 'VTI',
          quantity: 100,
          unitPrice: 0.5,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('DIVIDEND');
      expect(items[0].symbol).toBe('VTI');
      expect(items[0].acquisitionDate).toBe('');
      expect(items[0].proceeds).toBe(50);
      expect(items[0].costBasis).toBe(0);
      expect(items[0].gainLoss).toBe(50);
      expect(items[0].holdingPeriodInDays).toBe(0);
      expect(items[0].isLongTerm).toBe(false);
    });

    it('should exclude disposals outside the tax year', () => {
      const activities = [
        makeActivity({
          date: '2023-01-01',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        }),
        makeActivity({
          date: '2023-06-01',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 180,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      // Sell was in 2023, outside 2024 tax year
      expect(items).toHaveLength(0);
    });

    it('should include buys from prior years matched to sells in tax year', () => {
      const activities = [
        makeActivity({
          date: '2022-06-01',
          type: 'BUY',
          symbol: 'TSLA',
          quantity: 10,
          unitPrice: 200,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-01',
          type: 'SELL',
          symbol: 'TSLA',
          quantity: 10,
          unitPrice: 250,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(1);
      expect(items[0].gainLoss).toBe(500);
      // Jun 2022 to Jun 2024 = ~731 days
      expect(items[0].holdingPeriodInDays).toBeGreaterThanOrEqual(730);
      expect(items[0].isLongTerm).toBe(true);
    });

    it('should handle sells exceeding buys', () => {
      const activities = [
        makeActivity({
          date: '2024-06-15',
          type: 'SELL',
          symbol: 'TSLA',
          quantity: 5,
          unitPrice: 250,
          fee: 5
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(1);
      expect(items[0].acquisitionDate).toBe('');
      expect(items[0].costBasis).toBe(0);
      expect(items[0].proceeds).toBe(1245);
      expect(items[0].holdingPeriodInDays).toBe(0);
      expect(items[0].isLongTerm).toBe(false);
    });

    it('should handle multiple symbols independently', () => {
      const activities = [
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        }),
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 100,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-01',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 180,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-01',
          type: 'SELL',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 120,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(2);

      const aapl = items.find((i) => i.symbol === 'AAPL');
      const goog = items.find((i) => i.symbol === 'GOOG');

      expect(aapl.gainLoss).toBe(300);
      expect(goog.gainLoss).toBe(100);
    });

    it('should sort results by disposal date', () => {
      const activities = [
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        }),
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 100,
          fee: 0
        }),
        makeActivity({
          date: '2024-08-01',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 180,
          fee: 0
        }),
        makeActivity({
          date: '2024-05-01',
          type: 'SELL',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 120,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(2);
      expect(items[0].symbol).toBe('GOOG');
      expect(items[1].symbol).toBe('AAPL');
    });

    it('should return empty array for no activities', () => {
      const items = TaxReportService.computeTaxReportItems(
        [],
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(0);
    });

    it('should return empty array for buy-only activities', () => {
      const activities = [
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(0);
    });

    it('should handle a loss scenario', () => {
      const activities = [
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'META',
          quantity: 10,
          unitPrice: 300,
          fee: 10
        }),
        makeActivity({
          date: '2024-06-01',
          type: 'SELL',
          symbol: 'META',
          quantity: 10,
          unitPrice: 250,
          fee: 10
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(1);
      expect(items[0].costBasis).toBe(3010);
      expect(items[0].proceeds).toBe(2490);
      expect(items[0].gainLoss).toBe(-520);
    });

    it('should handle mixed short-term and long-term in same symbol', () => {
      const activities = [
        makeActivity({
          date: '2022-06-01',
          type: 'BUY',
          symbol: 'NVDA',
          quantity: 5,
          unitPrice: 200,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-01',
          type: 'BUY',
          symbol: 'NVDA',
          quantity: 5,
          unitPrice: 800,
          fee: 0
        }),
        makeActivity({
          date: '2024-09-01',
          type: 'SELL',
          symbol: 'NVDA',
          quantity: 10,
          unitPrice: 900,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(2);

      // First lot (FIFO): bought Jun 2022, sold Sep 2024 -> long-term
      expect(items[0].quantity).toBe(5);
      expect(items[0].isLongTerm).toBe(true);
      expect(items[0].gainLoss).toBe(3500); // (900-200)*5

      // Second lot: bought Jun 2024, sold Sep 2024 -> short-term
      expect(items[1].quantity).toBe(5);
      expect(items[1].isLongTerm).toBe(false);
      expect(items[1].gainLoss).toBe(500); // (900-800)*5
    });

    it('should exclude dividends outside the tax year', () => {
      const activities = [
        makeActivity({
          date: '2023-12-15',
          type: 'DIVIDEND',
          symbol: 'VTI',
          quantity: 100,
          unitPrice: 0.5,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(0);
    });
  });
});
