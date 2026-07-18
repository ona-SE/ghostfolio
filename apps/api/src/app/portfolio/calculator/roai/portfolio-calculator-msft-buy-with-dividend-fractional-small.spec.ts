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
    // Regression test for GHOS-7: a small fractional position (0.15 shares)
    // must scale the dividend by the actual fractional quantity, and the fee
    // must stay flat (not skewed by the fractional remainder). The mocked
    // MSFT price for 2021-09-16 is reused as the unit price so the buy date
    // does not depend on a separate market lookup.
    it('with MSFT small fractional buy and dividend', async () => {
      jest.useFakeTimers().setSystemTime(parseDate('2023-07-10').getTime());

      // Buy 0.15 shares of MSFT at $298.58
      // Receive dividend of $0.62/share on 0.15 shares = $0.093 total
      const activities: Activity[] = [
        {
          ...activityDummyData,
          date: new Date('2021-09-16'),
          feeInAssetProfileCurrency: 19,
          feeInBaseCurrency: 19,
          quantity: 0.15,
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
          quantity: 0.15,
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

      // With 0.15 shares:
      // Investment: 0.15 * 298.58 = 44.787
      // Dividend: 0.15 * 0.62 = 0.093 (NOT rounded up to a whole share)
      // Market value at end: 0.15 * 331.83 = 49.7745
      // Gross performance: 49.7745 - 44.787 = 4.9875
      // Net performance: 4.9875 - 19 = -14.0125 (fee is flat, not scaled)
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
            dividend: new Big('0.093'),
            dividendInBaseCurrency: new Big('0.093'),
            fee: new Big('19'),
            grossPerformance: new Big('4.9875'),
            grossPerformancePercentage: new Big('0.11136043941322258691'),
            grossPerformancePercentageWithCurrencyEffect: new Big(
              '0.11136043941322258691'
            ),
            grossPerformanceWithCurrencyEffect: new Big('4.9875'),
            investment: new Big('44.787'),
            investmentWithCurrencyEffect: new Big('44.787'),
            marketPrice: 331.83,
            marketPriceInBaseCurrency: 331.83,
            netPerformance: new Big('-14.0125'),
            netPerformancePercentage: new Big('-0.31286980597048250608'),
            netPerformancePercentageWithCurrencyEffectMap: {
              max: new Big('-0.31286980597048250608')
            },
            netPerformanceWithCurrencyEffectMap: {
              '1d': new Big('-0.8085'),
              '5y': new Big('-14.0125'),
              max: new Big('-14.0125'),
              wtd: new Big('-0.8085')
            },
            quantity: new Big('0.15'),
            symbol: 'MSFT',
            tags: []
          }
        ],
        totalFeesWithCurrencyEffect: new Big('19'),
        totalInterestWithCurrencyEffect: new Big('0'),
        totalInvestment: new Big('44.787'),
        totalInvestmentWithCurrencyEffect: new Big('44.787'),
        totalLiabilitiesWithCurrencyEffect: new Big('0')
      });

      expect(portfolioSnapshot.historicalData.at(-1)).toMatchObject(
        expect.objectContaining({
          totalInvestment: 44.787,
          totalInvestmentValueWithCurrencyEffect: 44.787
        })
      );
    });
  });
});
