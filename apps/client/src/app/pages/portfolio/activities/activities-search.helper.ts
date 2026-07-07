import { Activity } from '@ghostfolio/common/interfaces';

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
