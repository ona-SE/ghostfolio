import { ExportService } from './export.service';

describe('ExportService', () => {
  describe('computeTaxLots', () => {
    const accountMap = new Map([
      ['acc-1', 'Main Brokerage'],
      ['acc-2', 'Retirement']
    ]);

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

    it('should match a simple BUY then SELL (FIFO)', () => {
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

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(1);
      expect(items[0].symbol).toBe('AAPL');
      expect(items[0].type).toBe('SELL');
      expect(items[0].quantity).toBe(10);
      // Cost basis: 10 * 150 + 5 (buy fee) = 1505
      expect(items[0].costBasis).toBe(1505);
      // Proceeds: 10 * 180 - 5 (sell fee) = 1795
      expect(items[0].proceeds).toBe(1795);
      // Gain: 1795 - 1505 = 290
      expect(items[0].gainLoss).toBe(290);
      expect(items[0].acquisitionDate).toBe(
        new Date('2024-01-15').toISOString()
      );
      expect(items[0].disposalDate).toBe(new Date('2024-06-15').toISOString());
      expect(items[0].account).toBe('Main Brokerage');
    });

    it('should handle partial lot matching (FIFO order)', () => {
      const activities = [
        makeActivity({
          date: '2024-01-10',
          type: 'BUY',
          symbol: 'MSFT',
          quantity: 5,
          unitPrice: 300,
          fee: 10
        }),
        makeActivity({
          date: '2024-03-10',
          type: 'BUY',
          symbol: 'MSFT',
          quantity: 5,
          unitPrice: 320,
          fee: 10
        }),
        makeActivity({
          date: '2024-07-10',
          type: 'SELL',
          symbol: 'MSFT',
          quantity: 7,
          unitPrice: 350,
          fee: 14
        })
      ];

      const items = ExportService.computeTaxLots(activities, accountMap);

      // Should produce 2 tax lots: 5 from first buy, 2 from second buy
      expect(items).toHaveLength(2);

      // First lot: 5 shares from first buy at 300
      expect(items[0].quantity).toBe(5);
      // Cost basis: 5 * 300 + 5 * (10/5) = 1500 + 10 = 1510
      expect(items[0].costBasis).toBe(1510);
      // Proceeds: 5 * 350 - 5 * (14/7) = 1750 - 10 = 1740
      expect(items[0].proceeds).toBe(1740);
      expect(items[0].gainLoss).toBe(230);

      // Second lot: 2 shares from second buy at 320
      expect(items[1].quantity).toBe(2);
      // Cost basis: 2 * 320 + 2 * (10/5) = 640 + 4 = 644
      expect(items[1].costBasis).toBe(644);
      // Proceeds: 2 * 350 - 2 * (14/7) = 700 - 4 = 696
      expect(items[1].proceeds).toBe(696);
      expect(items[1].gainLoss).toBe(52);
    });

    it('should handle dividends as standalone items', () => {
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

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('DIVIDEND');
      expect(items[0].symbol).toBe('VTI');
      expect(items[0].acquisitionDate).toBe('');
      expect(items[0].proceeds).toBe(50); // 100 * 0.5
      expect(items[0].costBasis).toBe(0);
      expect(items[0].gainLoss).toBe(50);
    });

    it('should handle sells exceeding buys (missing data)', () => {
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

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(1);
      expect(items[0].acquisitionDate).toBe('');
      expect(items[0].costBasis).toBe(0);
      // Proceeds: 5 * 250 - 5 = 1245
      expect(items[0].proceeds).toBe(1245);
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

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(2);

      const aapl = items.find((i) => i.symbol === 'AAPL');
      const goog = items.find((i) => i.symbol === 'GOOG');

      expect(aapl.gainLoss).toBe(300); // (180-150)*10
      expect(goog.gainLoss).toBe(100); // (120-100)*5
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

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(2);
      // GOOG sold May, AAPL sold Aug — GOOG should come first
      expect(items[0].symbol).toBe('GOOG');
      expect(items[1].symbol).toBe('AAPL');
    });

    it('should return empty array for no activities', () => {
      const items = ExportService.computeTaxLots([], accountMap);
      expect(items).toHaveLength(0);
    });

    it('should return empty array for buy-only activities (no disposals)', () => {
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

      const items = ExportService.computeTaxLots(activities, accountMap);
      expect(items).toHaveLength(0);
    });

    it('should handle zero-fee transactions', () => {
      const activities = [
        makeActivity({
          date: '2024-01-01',
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 100,
          fee: 0
        }),
        makeActivity({
          date: '2024-06-01',
          type: 'SELL',
          symbol: 'AAPL',
          quantity: 10,
          unitPrice: 120,
          fee: 0
        })
      ];

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(1);
      expect(items[0].costBasis).toBe(1000);
      expect(items[0].proceeds).toBe(1200);
      expect(items[0].gainLoss).toBe(200);
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

      const items = ExportService.computeTaxLots(activities, accountMap);

      expect(items).toHaveLength(1);
      // Cost: 10*300 + 10 = 3010
      expect(items[0].costBasis).toBe(3010);
      // Proceeds: 10*250 - 10 = 2490
      expect(items[0].proceeds).toBe(2490);
      // Loss: 2490 - 3010 = -520
      expect(items[0].gainLoss).toBe(-520);
    });
  });
});
