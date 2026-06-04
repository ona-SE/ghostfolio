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

    it('should handle fractional share dividends correctly', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.15,
          unitPrice: 50000,
          fee: 10
        }),
        makeActivity({
          date: '2024-06-15',
          type: 'DIVIDEND',
          symbol: 'BTC',
          quantity: 0.15,
          unitPrice: 100,
          fee: 0.5
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
      // 0.15 * 100 - 0.5 = 14.5
      expect(items[0].proceeds).toBe(14.5);
      expect(items[0].gainLoss).toBe(14.5);
      expect(items[0].quantity).toBe(0.15);
    });

    it('should not leave ghost lots after selling fractional shares built from multiple buys', () => {
      // Three fractional buys that accumulate floating-point dust,
      // then a sell of the exact total.
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 50000,
          fee: 5
        }),
        makeActivity({
          date: '2024-02-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 51000,
          fee: 5
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 52000,
          fee: 5
        }),
        makeActivity({
          date: '2024-09-15',
          type: 'SELL',
          symbol: 'BTC',
          quantity: 0.15,
          unitPrice: 60000,
          fee: 10
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      // Should produce exactly 3 SELL items (one per matched lot), no ghost entries
      expect(items).toHaveLength(3);

      for (const item of items) {
        expect(item.type).toBe('SELL');
        expect(item.quantity).toBeCloseTo(0.05, 10);
        expect(item.acquisitionDate).not.toBe('');
      }

      // Total proceeds: 0.15 * 60000 - 10 fee = 8990
      // (sell fee is spread per-unit across lots, so cent-level rounding applies)
      const totalProceeds = items.reduce((sum, i) => sum + i.proceeds, 0);
      expect(totalProceeds).toBeCloseTo(8990, 1);
    });

    it('should compute correct fee-per-unit for fractional share positions', () => {
      // Buy 0.15 BTC with fee 25, sell 0.10, then sell 0.05
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.15,
          unitPrice: 50000,
          fee: 25
        }),
        makeActivity({
          date: '2024-06-15',
          type: 'SELL',
          symbol: 'BTC',
          quantity: 0.10,
          unitPrice: 55000,
          fee: 5
        }),
        makeActivity({
          date: '2024-09-15',
          type: 'SELL',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 58000,
          fee: 3
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate
      );

      expect(items).toHaveLength(2);

      // First sell: 0.10 shares
      // costBasis = 0.10 * 50000 + 0.10 * (25/0.15) = 5000 + 16.67 = 5016.67
      // proceeds = 0.10 * 55000 - 0.10 * (5/0.10) = 5500 - 5 = 5495
      expect(items[0].quantity).toBeCloseTo(0.10, 10);
      expect(items[0].costBasis).toBeCloseTo(5016.67, 2);

      // Second sell: 0.05 shares
      // costBasis = 0.05 * 50000 + 0.05 * (25/0.15) = 2500 + 8.33 = 2508.33
      expect(items[1].quantity).toBeCloseTo(0.05, 10);
      expect(items[1].costBasis).toBeCloseTo(2508.33, 2);
    });
  });

  describe('computeTaxReportItems with LIFO', () => {
    const accountMap = new Map([['acc-1', 'Main Brokerage']]);
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

    it('should match the most recent buy first under LIFO', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 300,
          fee: 0
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 320,
          fee: 0
        }),
        makeActivity({
          date: '2024-07-10',
          type: 'SELL',
          symbol: 'GOOG',
          quantity: 3,
          unitPrice: 350,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate,
        'LIFO'
      );

      expect(items).toHaveLength(1);
      // LIFO: should match the Mar 10 buy (unitPrice 320)
      expect(items[0].quantity).toBe(3);
      expect(items[0].costBasis).toBe(960); // 3 * 320
      expect(items[0].proceeds).toBe(1050); // 3 * 350
      expect(items[0].gainLoss).toBe(90);
      // Mar 10 -> Jul 10 = 122 days
      expect(items[0].holdingPeriodInDays).toBe(122);
    });

    it('should consume across lots in LIFO order', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 300,
          fee: 0
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'GOOG',
          quantity: 5,
          unitPrice: 320,
          fee: 0
        }),
        makeActivity({
          date: '2024-07-10',
          type: 'SELL',
          symbol: 'GOOG',
          quantity: 7,
          unitPrice: 350,
          fee: 0
        })
      ];

      const items = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate,
        'LIFO'
      );

      expect(items).toHaveLength(2);

      // First matched lot: 5 from second buy (Mar 10, $320)
      expect(items[0].quantity).toBe(5);
      expect(items[0].costBasis).toBe(1600);
      expect(items[0].acquisitionDate).toContain('2024-03-10');

      // Second matched lot: 2 from first buy (Jan 10, $300)
      expect(items[1].quantity).toBe(2);
      expect(items[1].costBasis).toBe(600);
      expect(items[1].acquisitionDate).toContain('2024-01-10');
    });

    it('should produce different results than FIFO for the same data', () => {
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
          quantity: 5,
          unitPrice: 900,
          fee: 0
        })
      ];

      const fifoItems = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate,
        'FIFO'
      );

      const lifoItems = TaxReportService.computeTaxReportItems(
        activities,
        accountMap,
        startDate,
        endDate,
        'LIFO'
      );

      // FIFO matches the 2022 buy -> long-term, gain = (900-200)*5 = 3500
      expect(fifoItems).toHaveLength(1);
      expect(fifoItems[0].isLongTerm).toBe(true);
      expect(fifoItems[0].gainLoss).toBe(3500);

      // LIFO matches the 2024 buy -> short-term, gain = (900-800)*5 = 500
      expect(lifoItems).toHaveLength(1);
      expect(lifoItems[0].isLongTerm).toBe(false);
      expect(lifoItems[0].gainLoss).toBe(500);
    });
  });

  describe('computeUnrealizedLots', () => {
    const accountMap = new Map([['acc-1', 'Main Brokerage']]);

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

    it('should return remaining lots after partial sell (FIFO)', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 5,
          unitPrice: 170,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-10',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 8,
          unitPrice: 200,
          fee: 0
        })
      ];

      const lots = TaxReportService.computeUnrealizedLots(
        activities,
        accountMap,
        'FIFO'
      );

      // FIFO: sold 8 from first lot (10), leaving 2 from first + 5 from second
      expect(lots).toHaveLength(2);
      expect(lots[0].quantity).toBe(2);
      expect(lots[0].unitPrice).toBe(150);
      expect(lots[1].quantity).toBe(5);
      expect(lots[1].unitPrice).toBe(170);
    });

    it('should return remaining lots after partial sell (LIFO)', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 5,
          unitPrice: 170,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-10',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 8,
          unitPrice: 200,
          fee: 0
        })
      ];

      const lots = TaxReportService.computeUnrealizedLots(
        activities,
        accountMap,
        'LIFO'
      );

      // LIFO: sold 5 from second lot + 3 from first, leaving 7 from first
      expect(lots).toHaveLength(1);
      expect(lots[0].quantity).toBe(7);
      expect(lots[0].unitPrice).toBe(150);
    });

    it('should return empty when all lots are sold', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 150,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-10',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 200,
          fee: 0
        })
      ];

      const lots = TaxReportService.computeUnrealizedLots(
        activities,
        accountMap,
        'FIFO'
      );

      expect(lots).toHaveLength(0);
    });

    it('should not leave ghost lots when fractional buys are fully sold', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 50000,
          fee: 5
        }),
        makeActivity({
          date: '2024-02-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 51000,
          fee: 5
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.05,
          unitPrice: 52000,
          fee: 5
        }),
        makeActivity({
          date: '2024-09-15',
          type: 'SELL',
          symbol: 'BTC',
          quantity: 0.15,
          unitPrice: 60000,
          fee: 10
        })
      ];

      const lots = TaxReportService.computeUnrealizedLots(
        activities,
        accountMap,
        'FIFO'
      );

      // All shares sold — no lots should remain
      expect(lots).toHaveLength(0);
    });
  });

  describe('simulateSell', () => {
    it('should project gain/loss for a simulated FIFO sell', () => {
      const buyLots = [
        {
          date: new Date('2023-01-15'),
          quantity: 10,
          unitPrice: 150,
          fee: 0,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'AAPL'
        },
        {
          date: new Date('2024-06-01'),
          quantity: 5,
          unitPrice: 200,
          fee: 0,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'AAPL'
        }
      ];

      const now = new Date('2024-12-01');
      const result = TaxReportService.simulateSell({
        buyLots,
        costBasisMethod: 'FIFO',
        now,
        quantityToSell: 12,
        sellPrice: 250
      });

      expect(result).toHaveLength(2);

      // First lot: 10 shares at $150 cost
      expect(result[0].quantity).toBe(10);
      expect(result[0].costBasis).toBe(1500);
      expect(result[0].proceeds).toBe(2500);
      expect(result[0].gainLoss).toBe(1000);
      expect(result[0].isLongTerm).toBe(true);

      // Second lot: 2 shares at $200 cost
      expect(result[1].quantity).toBe(2);
      expect(result[1].costBasis).toBe(400);
      expect(result[1].proceeds).toBe(500);
      expect(result[1].gainLoss).toBe(100);
      expect(result[1].isLongTerm).toBe(false);
    });

    it('should project gain/loss for a simulated LIFO sell', () => {
      const buyLots = [
        {
          date: new Date('2023-01-15'),
          quantity: 10,
          unitPrice: 150,
          fee: 0,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'AAPL'
        },
        {
          date: new Date('2024-06-01'),
          quantity: 5,
          unitPrice: 200,
          fee: 0,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'AAPL'
        }
      ];

      const now = new Date('2024-12-01');
      const result = TaxReportService.simulateSell({
        buyLots,
        costBasisMethod: 'LIFO',
        now,
        quantityToSell: 7,
        sellPrice: 250
      });

      expect(result).toHaveLength(2);

      // LIFO: second lot first (5 shares at $200)
      expect(result[0].quantity).toBe(5);
      expect(result[0].costBasis).toBe(1000);
      expect(result[0].proceeds).toBe(1250);
      expect(result[0].gainLoss).toBe(250);
      expect(result[0].isLongTerm).toBe(false);

      // Then 2 from first lot ($150)
      expect(result[1].quantity).toBe(2);
      expect(result[1].costBasis).toBe(300);
      expect(result[1].proceeds).toBe(500);
      expect(result[1].gainLoss).toBe(200);
      expect(result[1].isLongTerm).toBe(true);
    });

    it('should not mutate the original lots array', () => {
      const buyLots = [
        {
          date: new Date('2024-01-15'),
          quantity: 10,
          unitPrice: 150,
          fee: 0,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'AAPL'
        }
      ];

      TaxReportService.simulateSell({
        buyLots,
        costBasisMethod: 'FIFO',
        now: new Date('2024-12-01'),
        quantityToSell: 5,
        sellPrice: 200
      });

      // Original should be untouched
      expect(buyLots[0].quantity).toBe(10);
    });

    it('should handle fractional share lots without ghost matches', () => {
      const buyLots = [
        {
          date: new Date('2024-01-15'),
          quantity: 0.05,
          unitPrice: 50000,
          fee: 5,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'BTC'
        },
        {
          date: new Date('2024-02-15'),
          quantity: 0.05,
          unitPrice: 51000,
          fee: 5,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'BTC'
        },
        {
          date: new Date('2024-03-15'),
          quantity: 0.05,
          unitPrice: 52000,
          fee: 5,
          currency: 'USD',
          accountName: 'Main',
          symbol: 'BTC'
        }
      ];

      const result = TaxReportService.simulateSell({
        buyLots,
        costBasisMethod: 'FIFO',
        now: new Date('2024-12-01'),
        quantityToSell: 0.15,
        sellPrice: 60000
      });

      // Should match exactly 3 lots, no ghost 4th entry
      expect(result).toHaveLength(3);

      for (const lot of result) {
        expect(lot.quantity).toBeCloseTo(0.05, 10);
      }

      const totalProceeds = result.reduce((sum, l) => sum + l.proceeds, 0);
      // 0.15 * 60000 = 9000
      expect(totalProceeds).toBeCloseTo(9000, 2);
    });
  });
});
