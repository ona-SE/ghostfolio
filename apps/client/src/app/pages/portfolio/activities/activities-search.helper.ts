import { Activity } from '@ghostfolio/common/interfaces';

export interface ActivitiesFetchStrategy {
  // Whether the search query must be applied client-side after fetching
  applyClientSideSearch: boolean;
  // Number of rows to skip in the fetch request
  skip: number;
  // Number of rows to request
  take: number;
  // Whether the search query is delegated to the backend (SEARCH_QUERY filter)
  useServerSideSearch: boolean;
}

/**
 * Decides how the activities list is fetched for a given search query and
 * portfolio size (GHOS-52).
 *
 * - No search: page normally.
 * - Search with a portfolio below the threshold: fetch the first
 *   `serverSideSearchThreshold` rows once and filter/paginate on the client.
 * - Search with a portfolio at or above the threshold: delegate the search to
 *   the backend and page normally.
 *
 * A whitespace-only query is treated as no search so it stays consistent with
 * `filterActivitiesBySearchQuery`.
 */
export function resolveActivitiesFetchStrategy({
  activitiesCount,
  pageIndex,
  pageSize,
  searchQuery,
  serverSideSearchThreshold
}: {
  activitiesCount: number;
  pageIndex: number;
  pageSize: number;
  searchQuery: string;
  serverSideSearchThreshold: number;
}): ActivitiesFetchStrategy {
  const hasSearchQuery = !!searchQuery?.trim();

  if (!hasSearchQuery) {
    return {
      applyClientSideSearch: false,
      skip: pageIndex * pageSize,
      take: pageSize,
      useServerSideSearch: false
    };
  }

  const useServerSideSearch =
    (activitiesCount ?? 0) >= serverSideSearchThreshold;

  if (useServerSideSearch) {
    return {
      applyClientSideSearch: false,
      skip: pageIndex * pageSize,
      take: pageSize,
      useServerSideSearch: true
    };
  }

  return {
    applyClientSideSearch: true,
    skip: 0,
    take: serverSideSearchThreshold,
    useServerSideSearch: false
  };
}

/**
 * Filters the fetched activities by the search query and returns the slice for
 * the requested page together with the total match count (GHOS-52 client-side
 * path).
 */
export function paginateActivitiesForClientSideSearch({
  activities,
  pageIndex,
  pageSize,
  searchQuery
}: {
  activities: Activity[];
  pageIndex: number;
  pageSize: number;
  searchQuery: string;
}): { items: Activity[]; totalItems: number } {
  const filteredActivities = filterActivitiesBySearchQuery({
    activities,
    searchQuery
  });

  return {
    items: filteredActivities.slice(
      pageIndex * pageSize,
      (pageIndex + 1) * pageSize
    ),
    totalItems: filteredActivities.length
  };
}

export function filterActivitiesBySearchQuery({
  activities,
  searchQuery
}: {
  activities: Activity[];
  searchQuery: string;
}) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  if (!normalizedSearchQuery) {
    return activities;
  }

  return activities.filter((activity) => {
    const searchableValues = [
      activity.SymbolProfile?.id,
      activity.SymbolProfile?.isin,
      activity.SymbolProfile?.name,
      activity.SymbolProfile?.symbol,
      activity.account?.name,
      activity.comment,
      ...(activity.tags?.map(({ name }) => {
        return name;
      }) ?? [])
    ];

    return searchableValues.some((value) => {
      return value?.toLowerCase().includes(normalizedSearchQuery);
    });
  });
}
