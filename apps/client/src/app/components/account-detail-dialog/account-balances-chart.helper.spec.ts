import { AccountBalancesResponse } from '@ghostfolio/common/interfaces';

import { getHistoricalDataItemsFromAccountBalances } from './account-balances-chart.helper';

describe('getHistoricalDataItemsFromAccountBalances', () => {
  it('should format balances stored at UTC midnight on their UTC calendar date', () => {
    const result = getHistoricalDataItemsFromAccountBalances([
      {
        accountId: 'a',
        id: '1',
        date: new Date(Date.UTC(2024, 0, 15)),
        value: 1000,
        valueInBaseCurrency: 1000
      },
      {
        accountId: 'a',
        id: '2',
        date: new Date(Date.UTC(2024, 0, 16)),
        value: 1500,
        valueInBaseCurrency: 1500
      }
    ]);

    expect(result).toEqual([
      { date: '2024-01-15', value: 1000 },
      { date: '2024-01-16', value: 1500 }
    ]);
  });

  it('should not shift the date backwards for a UTC-midnight timestamp when the runtime is behind UTC', () => {
    // A user in a timezone behind UTC (e.g. UTC-5) sees the local
    // representation of a UTC-midnight timestamp fall on the previous calendar
    // day. The chart date must stay anchored to the stored UTC date. Simulate
    // that local view with an explicit negative-offset timestamp; formatting in
    // UTC must still yield the stored calendar day.
    const utcMidnight = new Date('2024-01-15T00:00:00.000Z');

    // Sanity check: the same instant, viewed at UTC-05:00, is 2024-01-14.
    expect(new Date('2024-01-14T19:00:00.000-05:00').getTime()).toBe(
      utcMidnight.getTime()
    );

    const result = getHistoricalDataItemsFromAccountBalances([
      {
        accountId: 'a',
        id: '1',
        date: utcMidnight,
        value: 2000,
        valueInBaseCurrency: 2000
      }
    ]);

    expect(result).toEqual([{ date: '2024-01-15', value: 2000 }]);
  });

  it('should accept ISO date strings and format them in UTC', () => {
    const result = getHistoricalDataItemsFromAccountBalances([
      {
        accountId: 'a',
        id: '1',
        date: '2024-03-10T00:00:00.000Z' as unknown as Date,
        value: 500,
        valueInBaseCurrency: 500
      }
    ]);

    expect(result).toEqual([{ date: '2024-03-10', value: 500 }]);
  });

  it('should return an empty array when there are no balances', () => {
    expect(getHistoricalDataItemsFromAccountBalances([])).toEqual([]);
  });

  it('should return an empty array when balances are nullish', () => {
    expect(
      getHistoricalDataItemsFromAccountBalances(
        undefined as unknown as AccountBalancesResponse['balances']
      )
    ).toEqual([]);
  });
});
