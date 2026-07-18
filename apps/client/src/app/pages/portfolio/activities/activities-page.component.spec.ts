import { Activity } from '@ghostfolio/common/interfaces';

import {
  filterActivitiesBySearchQuery,
  paginateActivitiesForClientSideSearch,
  resolveActivitiesFetchStrategy
} from './activities-search.helper';

const SERVER_SIDE_SEARCH_THRESHOLD = 1000;

describe('GfActivitiesPageComponent', () => {
  describe('resolveActivitiesFetchStrategy', () => {
    it('should page normally when there is no search query', () => {
      const strategy = resolveActivitiesFetchStrategy({
        activitiesCount: 5000,
        pageIndex: 2,
        pageSize: 20,
        searchQuery: '',
        serverSideSearchThreshold: SERVER_SIDE_SEARCH_THRESHOLD
      });

      expect(strategy).toEqual({
        applyClientSideSearch: false,
        skip: 40,
        take: 20,
        useServerSideSearch: false
      });
    });

    it('should treat a whitespace-only query as no search', () => {
      const strategy = resolveActivitiesFetchStrategy({
        activitiesCount: 10,
        pageIndex: 1,
        pageSize: 20,
        searchQuery: '   ',
        serverSideSearchThreshold: SERVER_SIDE_SEARCH_THRESHOLD
      });

      expect(strategy.applyClientSideSearch).toBe(false);
      expect(strategy.useServerSideSearch).toBe(false);
      expect(strategy.skip).toBe(20);
      expect(strategy.take).toBe(20);
    });

    it('should filter client-side below the threshold and fetch a single batch from the start', () => {
      const strategy = resolveActivitiesFetchStrategy({
        activitiesCount: 999,
        pageIndex: 3,
        pageSize: 20,
        searchQuery: 'aapl',
        serverSideSearchThreshold: SERVER_SIDE_SEARCH_THRESHOLD
      });

      expect(strategy).toEqual({
        applyClientSideSearch: true,
        skip: 0,
        take: SERVER_SIDE_SEARCH_THRESHOLD,
        useServerSideSearch: false
      });
    });

    it('should delegate to server-side search at the threshold boundary', () => {
      const strategy = resolveActivitiesFetchStrategy({
        activitiesCount: SERVER_SIDE_SEARCH_THRESHOLD,
        pageIndex: 2,
        pageSize: 20,
        searchQuery: 'aapl',
        serverSideSearchThreshold: SERVER_SIDE_SEARCH_THRESHOLD
      });

      expect(strategy).toEqual({
        applyClientSideSearch: false,
        skip: 40,
        take: 20,
        useServerSideSearch: true
      });
    });

    it('should default a missing activities count to client-side search', () => {
      const strategy = resolveActivitiesFetchStrategy({
        activitiesCount: undefined as unknown as number,
        pageIndex: 0,
        pageSize: 20,
        searchQuery: 'aapl',
        serverSideSearchThreshold: SERVER_SIDE_SEARCH_THRESHOLD
      });

      expect(strategy.useServerSideSearch).toBe(false);
      expect(strategy.applyClientSideSearch).toBe(true);
    });
  });

  describe('paginateActivitiesForClientSideSearch', () => {
    it('should filter and return only the requested page', () => {
      const activities = [
        createActivity({
          accountName: 'Brokerage',
          comment: '',
          symbol: 'AAPL',
          tags: []
        }),
        createActivity({
          accountName: 'Brokerage',
          comment: '',
          symbol: 'AAPL',
          tags: []
        }),
        createActivity({
          accountName: 'Brokerage',
          comment: '',
          symbol: 'AAPL',
          tags: []
        }),
        createActivity({
          accountName: 'Brokerage',
          comment: '',
          symbol: 'MSFT',
          tags: []
        })
      ];

      const { items, totalItems } = paginateActivitiesForClientSideSearch({
        activities,
        pageIndex: 1,
        pageSize: 2,
        searchQuery: 'aapl'
      });

      expect(totalItems).toBe(3);
      expect(items).toEqual([activities[2]]);
    });

    it('should report the full match count independent of the page slice', () => {
      const activities = Array.from({ length: 5 }, () => {
        return createActivity({
          accountName: 'Brokerage',
          comment: '',
          symbol: 'AAPL',
          tags: []
        });
      });

      const { items, totalItems } = paginateActivitiesForClientSideSearch({
        activities,
        pageIndex: 0,
        pageSize: 2,
        searchQuery: 'aapl'
      });

      expect(totalItems).toBe(5);
      expect(items).toHaveLength(2);
    });
  });

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
