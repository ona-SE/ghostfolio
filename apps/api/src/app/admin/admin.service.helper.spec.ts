import { endOfDay, startOfDay } from 'date-fns';

import { buildMarketDataDateRangeWhere } from './admin.service.helper';

describe('buildMarketDataDateRangeWhere', () => {
  it('returns undefined when no dates are provided', () => {
    expect(buildMarketDataDateRangeWhere({})).toBeUndefined();
  });

  it('returns undefined when both dates are invalid', () => {
    expect(
      buildMarketDataDateRangeWhere({
        endDate: 'not-a-date',
        startDate: 'also-not-a-date'
      })
    ).toBeUndefined();
  });

  it('builds a lower bound from a valid start date', () => {
    const where = buildMarketDataDateRangeWhere({ startDate: '2024-01-15' });

    expect(where).toEqual({
      activities: {
        some: {
          date: { gte: startOfDay(new Date('2024-01-15')) }
        }
      }
    });
  });

  it('builds an upper bound from a valid end date', () => {
    const where = buildMarketDataDateRangeWhere({ endDate: '2024-03-31' });

    expect(where).toEqual({
      activities: {
        some: {
          date: { lte: endOfDay(new Date('2024-03-31')) }
        }
      }
    });
  });

  it('builds an inclusive range when both dates are valid', () => {
    const where = buildMarketDataDateRangeWhere({
      endDate: '2024-03-31',
      startDate: '2024-01-15'
    });

    expect(where).toEqual({
      activities: {
        some: {
          date: {
            gte: startOfDay(new Date('2024-01-15')),
            lte: endOfDay(new Date('2024-03-31'))
          }
        }
      }
    });
  });

  it('ignores an invalid bound while keeping the valid one', () => {
    const where = buildMarketDataDateRangeWhere({
      endDate: 'garbage',
      startDate: '2024-01-15'
    });

    expect(where).toEqual({
      activities: {
        some: {
          date: { gte: startOfDay(new Date('2024-01-15')) }
        }
      }
    });
  });
});
