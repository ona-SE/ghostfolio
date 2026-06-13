import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';

import { randomUUID } from 'node:crypto';

import { AccountBalanceService } from './account-balance.service';

describe('AccountBalanceService', () => {
  let accountBalanceService: AccountBalanceService;
  let exchangeRateDataService: ExchangeRateDataService;

  beforeEach(() => {
    exchangeRateDataService = {
      toCurrency: (value: number) => {
        return value;
      }
    } as unknown as ExchangeRateDataService;

    accountBalanceService = new AccountBalanceService(
      null,
      exchangeRateDataService,
      null
    );
  });

  describe('getAccountBalanceItems', () => {
    it('groups balances by their UTC calendar date regardless of the runtime timezone', async () => {
      // Balances are stored at UTC midnight (see resetHours). For a user in a
      // timezone behind UTC, the local representation of that timestamp falls on
      // the previous calendar day. The grouping date must stay anchored to UTC.
      const accountId = randomUUID();

      jest
        .spyOn(accountBalanceService, 'getAccountBalances')
        .mockResolvedValue({
          balances: [
            {
              accountId,
              id: randomUUID(),
              date: new Date(Date.UTC(2024, 0, 15)),
              value: 1000,
              valueInBaseCurrency: 1000
            },
            {
              accountId,
              id: randomUUID(),
              date: new Date(Date.UTC(2024, 0, 16)),
              value: 1500,
              valueInBaseCurrency: 1500
            }
          ]
        });

      const items = await accountBalanceService.getAccountBalanceItems({
        userCurrency: 'USD',
        userId: randomUUID()
      });

      expect(items).toEqual([
        { date: '2024-01-15', value: 1000 },
        { date: '2024-01-16', value: 1500 }
      ]);
    });
  });
});
