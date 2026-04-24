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
    it('with MSFT fractional buy and dividend', async () => {
      jest.useFakeTimers().setSystemTime(parseDate('2023-07-10').getTime());

      // Buy 0.5 shares of MSFT at $298.58
      // Receive dividend of $0.62/share on 0.5 shares = $0.31 total
      const activities: Activity[] = [
        {
          ...activityDummyData,
          date: new Date('2021-09-16'),
          feeInAssetProfileCurrency: 19,
          feeInBaseCurrency: 19,
          quantity: 0.5,
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
          quantity: 0.5,
          SymbolProfile: {
            ...symbolProfileDummyData,
            currency: 'USD',
            dataSource: 'YAHOO',
            name: 'Microsoft Inc.',
            symbol: 'MSFT'
          },
          type: 'DIVIDEND',
          unitPriceInAssetProfileCurrency: 0.62
        }
      ];

      const portfolioCalculator = portfolioCalculatorFactory.createCalculator({
        activities,
        calculationType: PerformanceCalculationType.ROAI,
        currency: 'USD',
        userId: userDummyData.id
      });

      const portfolioSnapshot = await portfolioCalculator.computeSnapshot();

      // With 0.5 shares:
      // Investment: 0.5 * 298.58 = 149.29
      // Dividend: 0.5 * 0.62 = 0.31 (NOT 1 * 0.62 = 0.62)
      // Market value at end: 0.5 * 331.83 = 165.915
      // Gross performance: 165.915 - 149.29 = 16.625
      // Net performance: 16.625 - 19 = -2.375
      expect(portfolioSnapshot).toMatchObject({
        errors: [],
        hasErrors: false,
        positions: [
          {
            activitiesCount: 2,
            averagePrice: new Big('298.58'),
            currency: 'USD',
            dataSource: 'YAHOO',
            dateOfFirstActivity: '2021-09-16',
            dividend: new Big('0.31'),
            dividendInBaseCurrency: new Big('0.31'),
            fee: new Big('19'),
            grossPerformance: new Big('16.625'),
            grossPerformancePercentage: new Big('0.11136043941322258691'),
            grossPerformancePercentageWithCurrencyEffect: new Big(
              '0.11136043941322258691'
            ),
            grossPerformanceWithCurrencyEffect: new Big('16.625'),
            investment: new Big('149.29'),
            investmentWithCurrencyEffect: new Big('149.29'),
            marketPrice: 331.83,
            marketPriceInBaseCurrency: 331.83,
            netPerformance: new Big('-2.375'),
            netPerformancePercentage: new Big('-0.01590863420188894099'),
            netPerformancePercentageWithCurrencyEffectMap: {
              max: new Big('-0.01590863420188894099')
            },
            netPerformanceWithCurrencyEffectMap: {
              '1d': new Big('-2.695'),
              '5y': new Big('-2.375'),
              max: new Big('-2.375'),
              wtd: new Big('-2.695')
            },
            quantity: new Big('0.5'),
            symbol: 'MSFT',
            tags: []
          }
        ],
        totalFeesWithCurrencyEffect: new Big('19'),
        totalInterestWithCurrencyEffect: new Big('0'),
        totalInvestment: new Big('149.29'),
        totalInvestmentWithCurrencyEffect: new Big('149.29'),
        totalLiabilitiesWithCurrencyEffect: new Big('0')
      });

      expect(portfolioSnapshot.historicalData.at(-1)).toMatchObject(
        expect.objectContaining({
          totalInvestment: 149.29,
          totalInvestmentValueWithCurrencyEffect: 149.29
        })
      );
    });
  });
});
