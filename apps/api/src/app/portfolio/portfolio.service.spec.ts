import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import { SymbolProfileService } from '@ghostfolio/api/services/symbol-profile/symbol-profile.service';

import { Big } from 'big.js';
import { randomUUID } from 'node:crypto';

import { PortfolioCalculatorFactory } from './calculator/portfolio-calculator.factory';
import { PortfolioService } from './portfolio.service';

describe('PortfolioService', () => {
  // GHOS-1: getSummary must reuse the PortfolioCalculator already built by
  // getDetails instead of triggering a second full portfolio computation.
  describe('getDetails with summary', () => {
    let accountService: AccountService;
    let activitiesService: ActivitiesService;
    let calculatorFactory: PortfolioCalculatorFactory;
    let createCalculatorSpy: jest.Mock;
    let exchangeRateDataService: ExchangeRateDataService;
    let getPerformanceSpy: jest.Mock;
    let getSnapshotSpy: jest.Mock;
    let impersonationService: ImpersonationService;
    let portfolioService: PortfolioService;
    let symbolProfileService: SymbolProfileService;
    let userService: UserService;

    const userId = randomUUID();

    beforeEach(() => {
      getSnapshotSpy = jest.fn().mockResolvedValue({
        createdAt: new Date(),
        currentValueInBaseCurrency: new Big(0),
        hasErrors: false,
        historicalData: [],
        positions: [],
        totalInvestment: new Big(0),
        totalInvestmentWithCurrencyEffect: new Big(0)
      });

      getPerformanceSpy = jest.fn().mockResolvedValue({ chart: [] });

      // A single fake calculator instance. If getSummary were to build its own
      // calculator, createCalculator would be called more than once.
      const fakeCalculator = {
        getDividendInBaseCurrency: jest.fn().mockResolvedValue(new Big(0)),
        getFeesInBaseCurrency: jest.fn().mockResolvedValue(new Big(0)),
        getInterestInBaseCurrency: jest.fn().mockResolvedValue(new Big(0)),
        getLiabilitiesInBaseCurrency: jest.fn().mockResolvedValue(new Big(0)),
        getPerformance: getPerformanceSpy,
        getSnapshot: getSnapshotSpy,
        getStartDate: jest.fn().mockReturnValue(new Date())
      };

      createCalculatorSpy = jest.fn().mockReturnValue(fakeCalculator);

      calculatorFactory = {
        createCalculator: createCalculatorSpy
      } as unknown as PortfolioCalculatorFactory;

      accountService = {
        getAccounts: jest.fn().mockResolvedValue([]),
        getCashDetails: jest.fn().mockResolvedValue({
          accounts: [],
          balanceInBaseCurrency: 0
        })
      } as unknown as AccountService;

      activitiesService = {
        getActivities: jest.fn().mockResolvedValue({ activities: [] }),
        getActivitiesForPortfolioCalculator: jest
          .fn()
          .mockResolvedValue({ activities: [] })
      } as unknown as ActivitiesService;

      exchangeRateDataService = {
        toCurrency: (value: number) => {
          return value;
        }
      } as unknown as ExchangeRateDataService;

      impersonationService = {
        validateImpersonationId: jest.fn().mockResolvedValue(null)
      } as unknown as ImpersonationService;

      symbolProfileService = {
        getSymbolProfiles: jest.fn().mockResolvedValue([])
      } as unknown as SymbolProfileService;

      userService = {
        user: jest.fn().mockResolvedValue({
          id: userId,
          settings: {
            settings: {
              baseCurrency: 'USD'
            }
          }
        })
      } as unknown as UserService;

      portfolioService = new PortfolioService(
        null, // accountBalanceService
        accountService,
        activitiesService,
        null, // benchmarkService
        calculatorFactory,
        null, // dataProviderService
        exchangeRateDataService,
        null, // i18nService
        impersonationService,
        null, // request
        null, // rulesService
        symbolProfileService,
        userService
      );
    });

    it('builds the portfolio calculator exactly once and reuses it for the summary', async () => {
      const details = await portfolioService.getDetails({
        userId,
        impersonationId: undefined,
        withSummary: true
      });

      // GHOS-1 acceptance criteria: no second PortfolioCalculator is
      // instantiated during a /portfolio/details?withSummary=true request.
      expect(createCalculatorSpy).toHaveBeenCalledTimes(1);

      // The snapshot is computed once (in getDetails). getSummary derives its
      // performance values from the same calculator's getPerformance() rather
      // than rebuilding a fresh snapshot.
      expect(getSnapshotSpy).toHaveBeenCalledTimes(1);
      expect(getPerformanceSpy).toHaveBeenCalledTimes(1);

      expect(details.summary).toBeDefined();
    });

    it('does not compute the summary when withSummary is false', async () => {
      const details = await portfolioService.getDetails({
        userId,
        impersonationId: undefined,
        withSummary: false
      });

      expect(createCalculatorSpy).toHaveBeenCalledTimes(1);
      expect(getPerformanceSpy).not.toHaveBeenCalled();
      expect(details.summary).toBeUndefined();
    });
  });
});
