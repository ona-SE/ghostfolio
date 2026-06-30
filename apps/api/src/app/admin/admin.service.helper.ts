import { Prisma } from '@prisma/client';
import { endOfDay, isValid, parseISO, startOfDay } from 'date-fns';

/**
 * Builds a Prisma `where` fragment that restricts asset profiles to those with
 * at least one activity whose date falls within the given range.
 *
 * The admin market data table surfaces each profile's earliest activity date,
 * so the date-range filter is expressed against the `activities` relation.
 *
 * Returns `undefined` when neither bound is a valid ISO date, so callers can
 * skip applying a filter.
 */
export function buildMarketDataDateRangeWhere({
  endDate,
  startDate
}: {
  endDate?: string;
  startDate?: string;
}): Prisma.SymbolProfileWhereInput | undefined {
  const parsedStartDate = parseISO(startDate ?? '');
  const parsedEndDate = parseISO(endDate ?? '');

  const dateFilter: Prisma.DateTimeFilter = {};

  if (isValid(parsedStartDate)) {
    dateFilter.gte = startOfDay(parsedStartDate);
  }

  if (isValid(parsedEndDate)) {
    dateFilter.lte = endOfDay(parsedEndDate);
  }

  if (Object.keys(dateFilter).length === 0) {
    return undefined;
  }

  return {
    activities: {
      some: {
        date: dateFilter
      }
    }
  };
}
