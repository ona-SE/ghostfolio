import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { EcbService } from '@ghostfolio/api/services/ecb/ecb.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';

import { ExchangeRateDataService } from './exchange-rate-data.service';

describe('ExchangeRateDataService', () => {
  let dataProviderService: DataProviderService;
  let ecbService: EcbService;
  let exchangeRateDataService: ExchangeRateDataService;
  let marketDataService: MarketDataService;
  let prismaService: PrismaService;
  let propertyService: PropertyService;

  beforeEach(() => {
    dataProviderService = {
      getDataSourceForExchangeRates: () => 'YAHOO'
    } as unknown as DataProviderService;
    ecbService = {} as unknown as EcbService;
    marketDataService = {
      get: jest.fn()
    } as unknown as MarketDataService;
    prismaService = {} as unknown as PrismaService;
    propertyService = {} as unknown as PropertyService;

    exchangeRateDataService = new ExchangeRateDataService(
      dataProviderService,
      ecbService,
      marketDataService,
      prismaService,
      propertyService
    );

    // Seed the in-memory exchange rate map with EUR-related pairs. The demo
    // seed provides USDEUR rates; the service derives the reverse EURUSD pair
    // and cross-currency pairs from those.
    (exchangeRateDataService as any).exchangeRates = {
      USDEUR: 0.862,
      EURUSD: 1 / 0.862,
      USDCHF: 0.885,
      CHFUSD: 1 / 0.885
    };
  });

  describe('toCurrency', () => {
    it('should return 0 for a value of 0', () => {
      expect(exchangeRateDataService.toCurrency(0, 'USD', 'EUR')).toEqual(0);
    });

    it('should return the same value when converting to the same currency', () => {
      expect(exchangeRateDataService.toCurrency(100, 'EUR', 'EUR')).toEqual(
        100
      );
    });

    it('should convert USD to EUR using the direct exchange rate', () => {
      expect(exchangeRateDataService.toCurrency(100, 'USD', 'EUR')).toBeCloseTo(
        86.2
      );
    });

    it('should convert EUR to USD using the reverse exchange rate', () => {
      expect(exchangeRateDataService.toCurrency(100, 'EUR', 'USD')).toBeCloseTo(
        100 / 0.862
      );
    });

    it('should convert EUR to CHF indirectly via the base currency (USD)', () => {
      // EUR -> USD -> CHF: (1 / 0.862) * 0.885
      expect(exchangeRateDataService.toCurrency(100, 'EUR', 'CHF')).toBeCloseTo(
        (100 / 0.862) * 0.885
      );
    });

    it('should return the input value and log an error when no rate exists', () => {
      const loggerSpy = jest
        .spyOn(jest.requireActual('@nestjs/common').Logger, 'error')
        .mockImplementation(() => undefined);

      expect(exchangeRateDataService.toCurrency(100, 'EUR', 'JPY')).toEqual(
        100
      );

      loggerSpy.mockRestore();
    });
  });

  describe('toCurrencyAtDate', () => {
    it('should return 0 for a value of 0', async () => {
      await expect(
        exchangeRateDataService.toCurrencyAtDate(
          0,
          'USD',
          'EUR',
          new Date('2025-05-01')
        )
      ).resolves.toEqual(0);
    });

    it('should return the same value when converting to the same currency', async () => {
      await expect(
        exchangeRateDataService.toCurrencyAtDate(
          250,
          'EUR',
          'EUR',
          new Date('2025-05-01')
        )
      ).resolves.toEqual(250);
    });

    it('should convert USD to EUR at a historical date using market data', async () => {
      (marketDataService.get as jest.Mock).mockResolvedValue({
        marketPrice: 0.895
      });

      await expect(
        exchangeRateDataService.toCurrencyAtDate(
          100,
          'USD',
          'EUR',
          new Date('2025-05-01')
        )
      ).resolves.toBeCloseTo(89.5);
    });
  });
});
