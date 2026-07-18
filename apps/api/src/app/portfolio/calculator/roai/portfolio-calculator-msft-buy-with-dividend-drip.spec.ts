import {
  activityDummyData,
  symbolProfileDummyData,
  userDummyData
} from '@ghostfolio/api/app/portfolio/calculator/portfolio-calculator-test-utils';
import { PortfolioCalculatorFactory } from '@ghostfolio/api/app/portfolio/calculator/portfolio-calculator.factory';
import { CurrentRateService } from '@ghostfolio/api/app/portfolio/current-rate.service';
import { CurrentRateServiceMock } from '@ghostfolio/api/app/portfolio/current-rate.service.mock';
import { RedisCacheService } from '@ghostfolio/api/app/redis-cache/redis-cache.service';
import { RedisCacheServiceMock } from '@ghostfolio/api/app/redis-cache/redis-cache.service.mock';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PortfolioSnapshotService } from '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.service';
import { PortfolioSnapshotServiceMock } from '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.service.mock';
import { parseDate } from '@ghostfolio/common/helper';
import { Activity } from '@ghostfolio/common/interfaces';
import { PerformanceCalculationType } from '@ghostfolio/common/types/performance-calculation-type.type';

import { Big } from 'big.js';

jest.mock('@ghostfolio/api/app/portfolio/current-rate.service', () => {
  return {
    CurrentRateService: jest.fn().mockImplementation(() => {
      return CurrentRateServiceMock;
    })
  };
});

jest.mock(
  '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.service',
  () => {
    return {
      PortfolioSnapshotService: jest.fn().mockImplementation(() => {
        return PortfolioSnapshotServiceMock;
      })
    };
  }
);

jest.mock('@ghostfolio/api/app/redis-cache/redis-cache.service', () => {
  return {
    RedisCacheService: jest.fn().mockImplementation(() => {
      return RedisCacheServiceMock;
    })
  };
});

describe('PortfolioCalculator', () => {
  let configurationService: ConfigurationService;
  let currentRateService: CurrentRateService;
  let exchangeRateDataService: ExchangeRateDataService;
  let portfolioCalculatorFactory: PortfolioCalculatorFactory;
  let portfolioSnapshotService: PortfolioSnapshotService;
  let redisCacheService: RedisCacheService;

  beforeEach(() => {
    configurationService = new ConfigurationService();

    currentRateService = new CurrentRateService(null, null, null, null);

    exchangeRateDataService = new ExchangeRateDataService(
      null,
      null,
      null,
      null,
      null
    );

    portfolioSnapshotService = new PortfolioSnapshotService(null);

    redisCacheService = new RedisCacheService(null, null);

    portfolioCalculatorFactory = new PortfolioCalculatorFactory(
      configurationService,
      currentRateService,
      exchangeRateDataService,
      portfolioSnapshotService,
      redisCacheService
    );
  });

  describe('get current positions', () => {
    it.only('with MSFT buy, dividend, and DRIP reinvestment buy', async () => {
      jest.useFakeTimers().setSystemTime(parseDate('2023-07-10').getTime());

      // Scenario: Buy 1 share of MSFT, receive a dividend, then reinvest
      // the dividend by buying a fractional share.
      //
      // 1. Buy 1 share at $298.58 (fee $19)
      // 2. Receive dividend of $0.62 per share (1 share)
      // 3. Reinvest: Buy ~0.002 shares at $310.00 (fee $0) — value ~$0.62
      const activities: Activity[] = [
        {
          ...activityDummyData,
          date: new Date('2021-09-16'),
          feeInAssetProfileCurrency: 19,
          feeInBaseCurrency: 19,
          quantity: 1,
          SymbolProfile: {
            ...symbolProfileDummyData,
            currency: 'USD',
            dataSource: 'YAHOO',
            name: 'Microsoft Inc.',
            symbol: 'MSFT'
          },
          type: 'BUY',
          unitPriceInAssetProfileCurrency: 298.58
        },
        {
          ...activityDummyData,
          date: new Date('2021-11-16'),
          feeInAssetProfileCurrency: 0,
          feeInBaseCurrency: 0,
          quantity: 1,
          SymbolProfile: {
            ...symbolProfileDummyData,
            currency: 'USD',
            dataSource: 'YAHOO',
            name: 'Microsoft Inc.',
            symbol: 'MSFT'
          },
          type: 'DIVIDEND',
          unitPriceInAssetProfileCurrency: 0.62
        },
        {
          ...activityDummyData,
          date: new Date('2021-11-16'),
          feeInAssetProfileCurrency: 0,
          feeInBaseCurrency: 0,
          quantity: 0.002,
          SymbolProfile: {
            ...symbolProfileDummyData,
            currency: 'USD',
            dataSource: 'YAHOO',
            name: 'Microsoft Inc.',
            symbol: 'MSFT'
          },
          type: 'BUY',
          unitPriceInAssetProfileCurrency: 310
        }
      ];

      const portfolioCalculator = portfolioCalculatorFactory.createCalculator({
        activities,
        calculationType: PerformanceCalculationType.ROAI,
        currency: 'USD',
        userId: userDummyData.id
      });

      const portfolioSnapshot = await portfolioCalculator.computeSnapshot();

      // Total quantity: 1 + 0.002 = 1.002
      // Total investment: 298.58 + (0.002 * 310) = 298.58 + 0.62 = 299.20
      // Dividend: 1 * 0.62 = 0.62
      // Market value at end: 1.002 * 331.83 = 332.49366
      // Gross performance: 332.49366 - 299.20 = 33.29366
      expect(portfolioSnapshot).toMatchObject({
        errors: [],
        hasErrors: false,
        positions: [
          {
            activitiesCount: 3,
            currency: 'USD',
            dataSource: 'YAHOO',
            dateOfFirstActivity: '2021-09-16',
            dividend: new Big('0.62'),
            dividendInBaseCurrency: new Big('0.62'),
            fee: new Big('19'),
            quantity: new Big('1.002'),
            symbol: 'MSFT',
            tags: []
          }
        ],
        totalFeesWithCurrencyEffect: new Big('19'),
        totalInterestWithCurrencyEffect: new Big('0'),
        totalLiabilitiesWithCurrencyEffect: new Big('0')
      });
    });
  });
});
