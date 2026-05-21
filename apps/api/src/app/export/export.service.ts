import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { environment } from '@ghostfolio/api/environments/environment';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { TagService } from '@ghostfolio/api/services/tag/tag.service';
import {
  ExportResponse,
  Filter,
  TaxCsvExportItem,
  TaxCsvExportResponse,
  UserSettings
} from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import { Platform, Prisma, Type as ActivityType } from '@prisma/client';
import { groupBy, uniqBy } from 'lodash';

@Injectable()
export class ExportService {
  public constructor(
    private readonly accountService: AccountService,
    private readonly activitiesService: ActivitiesService,
    private readonly marketDataService: MarketDataService,
    private readonly tagService: TagService
  ) {}

  public async export({
    activityIds,
    activityTypes,
    filters,
    userId,
    userSettings
  }: {
    activityIds?: string[];
    activityTypes?: ActivityType[];
    filters?: Filter[];
    userId: string;
    userSettings: UserSettings;
  }): Promise<ExportResponse> {
    const { ACCOUNT: filtersByAccount } = groupBy(filters, ({ type }) => {
      return type;
    });
    const platformsMap: { [platformId: string]: Platform } = {};

    let { activities } = await this.activitiesService.getActivities({
      filters,
      userId,
      includeDrafts: true,
      sortColumn: 'date',
      sortDirection: 'asc',
      types: activityTypes,
      userCurrency: userSettings?.baseCurrency,
      withExcludedAccountsAndActivities: true
    });

    if (activityIds?.length > 0) {
      activities = activities.filter(({ id }) => {
        return activityIds.includes(id);
      });
    }

    const where: Prisma.AccountWhereInput = { userId };

    if (filtersByAccount?.length > 0) {
      where.id = {
        in: filtersByAccount.map(({ id }) => {
          return id;
        })
      };
    }

    const accounts = (
      await this.accountService.accounts({
        where,
        include: {
          balances: true,
          platform: true
        },
        orderBy: {
          name: 'asc'
        }
      })
    )
      .filter(({ id }) => {
        return activityIds?.length > 0
          ? activities.some(({ accountId }) => {
              return accountId === id;
            })
          : true;
      })
      .map(
        ({
          balance,
          balances,
          comment,
          currency,
          id,
          isDrip,
          isExcluded,
          name,
          platform,
          platformId
        }) => {
          if (platformId) {
            platformsMap[platformId] = platform;
          }

          return {
            balance,
            balances: balances.map(({ date, value }) => {
              return { date: date.toISOString(), value };
            }),
            comment,
            currency,
            id,
            isDrip,
            isExcluded,
            name,
            platformId
          };
        }
      );

    const customAssetProfiles = uniqBy(
      activities
        .map(({ SymbolProfile }) => {
          return SymbolProfile;
        })
        .filter(({ userId: assetProfileUserId }) => {
          return assetProfileUserId === userId;
        }),
      ({ id }) => {
        return id;
      }
    );

    const marketDataByAssetProfile = Object.fromEntries(
      await Promise.all(
        customAssetProfiles.map(async ({ dataSource, id, symbol }) => {
          const marketData = (
            await this.marketDataService.marketDataItems({
              where: { dataSource, symbol }
            })
          ).map(({ date, marketPrice }) => ({
            date: date.toISOString(),
            marketPrice
          }));

          return [id, marketData] as const;
        })
      )
    );

    const tags = (await this.tagService.getTagsForUser(userId))
      .filter(({ id, isUsed }) => {
        return (
          isUsed &&
          activities.some((activity) => {
            return activity.tags.some(({ id: tagId }) => {
              return tagId === id;
            });
          })
        );
      })
      .map(({ id, name }) => {
        return {
          id,
          name
        };
      });

    return {
      meta: { date: new Date().toISOString(), version: environment.version },
      accounts,
      assetProfiles: customAssetProfiles.map(
        ({
          assetClass,
          assetSubClass,
          comment,
          countries,
          currency,
          cusip,
          dataSource,
          figi,
          figiComposite,
          figiShareClass,
          holdings,
          id,
          isActive,
          isin,
          name,
          sectors,
          symbol,
          url
        }) => {
          return {
            assetClass,
            assetSubClass,
            comment,
            countries: countries as unknown as Prisma.JsonArray,
            currency,
            cusip,
            dataSource,
            figi,
            figiComposite,
            figiShareClass,
            holdings: holdings as unknown as Prisma.JsonArray,
            isActive,
            isin,
            marketData: marketDataByAssetProfile[id],
            name,
            sectors: sectors as unknown as Prisma.JsonArray,
            symbol,
            url
          };
        }
      ),
      platforms: Object.values(platformsMap),
      tags,
      activities: activities.map(
        ({
          accountId,
          comment,
          currency,
          date,
          fee,
          id,
          quantity,
          SymbolProfile,
          tags: currentTags,
          type,
          unitPrice
        }) => {
          return {
            accountId,
            comment,
            fee,
            id,
            quantity,
            type,
            unitPrice,
            currency: currency ?? SymbolProfile.currency,
            dataSource: SymbolProfile.dataSource,
            date: date.toISOString(),
            symbol: SymbolProfile.symbol,
            tags: currentTags.map(({ id: tagId }) => {
              return tagId;
            })
          };
        }
      ),
      user: {
        settings: {
          currency: userSettings?.baseCurrency,
          performanceCalculationType: userSettings?.performanceCalculationType
        }
      }
    };
  }

  public async exportTaxCsv({
    endDate,
    filters,
    startDate,
    userId,
    userSettings
  }: {
    endDate?: Date;
    filters?: Filter[];
    startDate?: Date;
    userId: string;
    userSettings: UserSettings;
  }): Promise<TaxCsvExportResponse> {
    // Fetch all BUY/SELL/DIVIDEND activities sorted by date ascending
    const { activities } = await this.activitiesService.getActivities({
      endDate,
      filters,
      startDate,
      userId,
      includeDrafts: false,
      sortColumn: 'date',
      sortDirection: 'asc',
      types: ['BUY', 'SELL', 'DIVIDEND'] as ActivityType[],
      userCurrency: userSettings?.baseCurrency,
      withExcludedAccountsAndActivities: false
    });

    // Build account name lookup
    const accounts = await this.accountService.accounts({
      where: { userId },
      orderBy: { name: 'asc' }
    });

    const accountMap = new Map(
      accounts.map((account) => [account.id, account.name])
    );

    const items = ExportService.computeTaxLots(activities, accountMap);

    return {
      meta: { date: new Date().toISOString(), version: environment.version },
      items
    };
  }

  /**
   * FIFO matching of BUY→SELL pairs per symbol to produce tax lot records.
   * Dividend activities are passed through as-is (no lot matching needed).
   */
  public static computeTaxLots(
    activities: {
      accountId?: string;
      currency?: string;
      date: Date;
      fee: number;
      quantity: number;
      SymbolProfile: { currency?: string; symbol: string };
      type: string;
      unitPrice: number;
    }[],
    accountMap: Map<string, string>
  ): TaxCsvExportItem[] {
    interface BuyLot {
      date: Date;
      quantity: number;
      unitPrice: number;
      fee: number;
      currency: string;
      accountName: string;
    }

    // Group activities by symbol
    const bySymbol = new Map<string, typeof activities>();

    for (const activity of activities) {
      const symbol = activity.SymbolProfile.symbol;
      const list = bySymbol.get(symbol) ?? [];
      list.push(activity);
      bySymbol.set(symbol, list);
    }

    const items: TaxCsvExportItem[] = [];

    for (const [symbol, symbolActivities] of bySymbol) {
      const buyQueue: BuyLot[] = [];

      for (const activity of symbolActivities) {
        const currency =
          activity.currency ?? activity.SymbolProfile.currency ?? '';
        const accountName = activity.accountId
          ? (accountMap.get(activity.accountId) ?? '')
          : '';

        if (activity.type === 'DIVIDEND') {
          items.push({
            acquisitionDate: '',
            disposalDate: activity.date.toISOString(),
            symbol,
            currency,
            quantity: activity.quantity,
            costBasis: 0,
            proceeds: activity.quantity * activity.unitPrice - activity.fee,
            gainLoss: activity.quantity * activity.unitPrice - activity.fee,
            account: accountName,
            type: 'DIVIDEND'
          });
          continue;
        }

        if (activity.type === 'BUY') {
          buyQueue.push({
            date: activity.date,
            quantity: activity.quantity,
            unitPrice: activity.unitPrice,
            fee: activity.fee,
            currency,
            accountName
          });
          continue;
        }

        // SELL — match against buy queue (FIFO)
        let remainingToSell = activity.quantity;
        const sellPrice = activity.unitPrice;
        const sellDate = activity.date;
        const sellFee = activity.fee;
        const sellFeePerUnit =
          activity.quantity > 0 ? sellFee / activity.quantity : 0;

        while (remainingToSell > 0 && buyQueue.length > 0) {
          const lot = buyQueue[0];
          const matched = Math.min(remainingToSell, lot.quantity);
          const buyFeePerUnit = lot.quantity > 0 ? lot.fee / lot.quantity : 0;

          // Pro-rate fees for partial lot matches
          const costBasis = matched * lot.unitPrice + matched * buyFeePerUnit;
          const proceeds = matched * sellPrice - matched * sellFeePerUnit;
          const gainLoss = proceeds - costBasis;

          items.push({
            acquisitionDate: lot.date.toISOString(),
            disposalDate: sellDate.toISOString(),
            symbol,
            currency,
            quantity: matched,
            costBasis: Math.round(costBasis * 100) / 100,
            proceeds: Math.round(proceeds * 100) / 100,
            gainLoss: Math.round(gainLoss * 100) / 100,
            account: accountName,
            type: 'SELL'
          });

          lot.quantity -= matched;
          lot.fee -= matched * buyFeePerUnit;
          remainingToSell -= matched;

          if (lot.quantity <= 0) {
            buyQueue.shift();
          }
        }

        // If sells exceed buys (short sales or missing data), record with no acquisition date
        if (remainingToSell > 0) {
          const proceeds =
            remainingToSell * sellPrice - remainingToSell * sellFeePerUnit;

          items.push({
            acquisitionDate: '',
            disposalDate: sellDate.toISOString(),
            symbol,
            currency,
            quantity: remainingToSell,
            costBasis: 0,
            proceeds: Math.round(proceeds * 100) / 100,
            gainLoss: Math.round(proceeds * 100) / 100,
            account: accountName,
            type: 'SELL'
          });
        }
      }
    }

    // Sort by disposal date
    items.sort((a, b) => a.disposalDate.localeCompare(b.disposalDate));

    return items;
  }
}
