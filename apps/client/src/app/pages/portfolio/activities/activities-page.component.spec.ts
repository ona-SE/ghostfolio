import { Activity } from '@ghostfolio/common/interfaces';

import { filterActivitiesBySearchQuery } from './activities-search.helper';

describe('GfActivitiesPageComponent', () => {
  describe('filterActivitiesBySearchQuery', () => {
    it('should match symbol, account name, tag and comment', () => {
      const activities = [
        createActivity({
          accountName: 'Main Brokerage',
          comment: 'monthly buy',
          symbol: 'AAPL',
          tags: ['core']
        }),
        createActivity({
          accountName: 'Savings',
          comment: 'cash balance',
          symbol: 'USD',
          tags: ['liquidity']
        })
      ];

      expect(search(activities, 'aap')).toEqual([activities[0]]);
      expect(search(activities, 'brokerage')).toEqual([activities[0]]);
      expect(search(activities, 'core')).toEqual([activities[0]]);
      expect(search(activities, 'monthly')).toEqual([activities[0]]);
    });

    it('should match case-insensitively and trim the query', () => {
      const activities = [
        createActivity({
          accountName: 'Retirement',
          comment: 'Dividend',
          symbol: 'MSFT',
          tags: ['Income']
        })
      ];

      expect(search(activities, '  income  ')).toEqual(activities);
      expect(search(activities, 'dividend')).toEqual(activities);
    });

    it('should return all activities for an empty query', () => {
      const activities = [
        createActivity({
          accountName: 'Brokerage',
          comment: 'Buy',
          symbol: 'VOO',
          tags: []
        })
      ];

      expect(search(activities, '   ')).toEqual(activities);
    });
  });
});

function search(activities: Activity[], searchQuery: string) {
  return filterActivitiesBySearchQuery({
    activities,
    searchQuery
  });
}

function createActivity({
  accountName,
  comment,
  symbol,
  tags
}: {
  accountName: string;
  comment: string;
  symbol: string;
  tags: string[];
}) {
  return {
    account: { name: accountName },
    comment,
    SymbolProfile: {
      symbol
    },
    tags: tags.map((name) => {
      return { name };
    })
  } as Activity;
}
