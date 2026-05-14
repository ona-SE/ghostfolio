import { EcbService } from './ecb.service';

describe('EcbService', () => {
  let ecbService: EcbService;

  beforeEach(() => {
    ecbService = new EcbService();
  });

  describe('convertToBaseCurrency', () => {
    const ecbRates: { [currency: string]: number } = {
      EUR: 1,
      USD: 1.18,
      CHF: 1.08,
      GBP: 0.86,
      JPY: 130.0
    };

    it('converts ECB rates to USD base', () => {
      const result = ecbService.convertToBaseCurrency(ecbRates, 'USD');

      // 1 USD = (1 / 1.18) EUR
      expect(result['USDEUR']).toBeCloseTo(1 / 1.18, 5);

      // 1 USD = (1.08 / 1.18) CHF
      expect(result['USDCHF']).toBeCloseTo(1.08 / 1.18, 5);

      // 1 USD = (0.86 / 1.18) GBP
      expect(result['USDGBP']).toBeCloseTo(0.86 / 1.18, 5);

      // 1 USD = (130 / 1.18) JPY
      expect(result['USDJPY']).toBeCloseTo(130.0 / 1.18, 5);

      // Should not include USDUSD
      expect(result['USDUSD']).toBeUndefined();
    });

    it('converts ECB rates to EUR base', () => {
      const result = ecbService.convertToBaseCurrency(ecbRates, 'EUR');

      // 1 EUR = 1.18 USD (direct ECB rate)
      expect(result['EURUSD']).toBeCloseTo(1.18, 5);

      // 1 EUR = 1.08 CHF
      expect(result['EURCHF']).toBeCloseTo(1.08, 5);
    });

    it('returns empty map when base currency is not covered', () => {
      const result = ecbService.convertToBaseCurrency(ecbRates, 'BTC');

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
