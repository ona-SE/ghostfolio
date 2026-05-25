import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { environment } from '@ghostfolio/api/environments/environment';
import {
  CostBasisMethod,
  Filter,
  SimulateSellResponse,
  TaxReportItem,
  TaxReportResponse,
  UserSettings
} from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import { Type as ActivityType } from '@prisma/client';

export interface BuyLot {
  date: Date;
  quantity: number;
  unitPrice: number;
  fee: number;
  currency: string;
  accountName: string;
  symbol: string;
}

@Injectable()
export class TaxReportService {
  public constructor(
    private readonly accountService: AccountService,
    private readonly activitiesService: ActivitiesService
  ) {}

  /**
   * Returns unrealized (still-held) lots after replaying all BUY/SELL
   * activity through the chosen cost-basis method.
   */
  public static computeUnrealizedLots(
    activities: ActivityRecord[],
    accountMap: Map<string, string>,
    costBasisMethod: CostBasisMethod
  ): BuyLot[] {
    const bySymbol = TaxReportService.groupBySymbol(activities);
    const allRemainingLots: BuyLot[] = [];

    for (const [symbol, symbolActivities] of bySymbol) {
      const buyLots: BuyLot[] = [];

      for (const activity of symbolActivities) {
        const currency =
          activity.currency ?? activity.SymbolProfile.currency ?? '';
        const accountName = activity.accountId
          ? (accountMap.get(activity.accountId) ?? '')
          : '';

        if (activity.type === 'BUY') {
          buyLots.push({
            currency,
            accountName,
            symbol,
            date: activity.date,
            fee: activity.fee,
            quantity: activity.quantity,
            unitPrice: activity.unitPrice
          });
          continue;
        }

        if (activity.type === 'SELL') {
          TaxReportService.consumeLots(
            buyLots,
            activity.quantity,
            costBasisMethod
          );
        }
      }

      for (const lot of buyLots) {
        if (lot.quantity > 0) {
          allRemainingLots.push(lot);
        }
      }
    }

    return allRemainingLots;
  }

  /**
   * Simulates selling a given quantity of a symbol and returns projected
   * gain/loss broken down by matched lot.
   */
  public static simulateSell({
    buyLots,
    costBasisMethod,
    now,
    quantityToSell,
    sellPrice
  }: {
    buyLots: BuyLot[];
    costBasisMethod: CostBasisMethod;
    now: Date;
    quantityToSell: number;
    sellPrice: number;
  }): SimulateSellResponse['lots'] {
    // Deep-copy lots so simulation doesn't mutate the originals
    const lots = buyLots.map((l) => ({ ...l }));
    const result: SimulateSellResponse['lots'] = [];
    let remaining = quantityToSell;
    const LONG_TERM_THRESHOLD_DAYS = 365;

    while (remaining > 0 && lots.length > 0) {
      const idx = costBasisMethod === 'LIFO' ? lots.length - 1 : 0;
      const lot = lots[idx];
      const matched = Math.min(remaining, lot.quantity);
      const buyFeePerUnit = lot.quantity > 0 ? lot.fee / lot.quantity : 0;

      const costBasis = matched * lot.unitPrice + matched * buyFeePerUnit;
      const proceeds = matched * sellPrice;
      const gainLoss = proceeds - costBasis;
      const holdingPeriodInDays = Math.floor(
        (now.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24)
      );

      result.push({
        acquisitionDate: lot.date.toISOString(),
        quantity: matched,
        costBasis: Math.round(costBasis * 100) / 100,
        proceeds: Math.round(proceeds * 100) / 100,
        gainLoss: Math.round(gainLoss * 100) / 100,
        holdingPeriodInDays,
        isLongTerm: holdingPeriodInDays >= LONG_TERM_THRESHOLD_DAYS
      });

      lot.quantity -= matched;
      lot.fee -= matched * buyFeePerUnit;
      remaining -= matched;

      if (lot.quantity <= 0) {
        lots.splice(idx, 1);
      }
    }

    return result;
  }

  /**
   * Lot matching of BUY→SELL pairs per symbol, enriched with holding period
   * and long-term classification. Supports FIFO and LIFO methods.
   * Only disposals (SELL/DIVIDEND) within the date range are included.
   */
  public static computeTaxReportItems(
    activities: ActivityRecord[],
    accountMap: Map<string, string>,
    startDate: Date,
    endDate: Date,
    costBasisMethod: CostBasisMethod = 'FIFO'
  ): TaxReportItem[] {
    const bySymbol = TaxReportService.groupBySymbol(activities);
    const items: TaxReportItem[] = [];
    const LONG_TERM_THRESHOLD_DAYS = 365;

    for (const [symbol, symbolActivities] of bySymbol) {
      const buyLots: BuyLot[] = [];

      for (const activity of symbolActivities) {
        const currency =
          activity.currency ?? activity.SymbolProfile.currency ?? '';
        const accountName = activity.accountId
          ? (accountMap.get(activity.accountId) ?? '')
          : '';
        const activityDate = activity.date;

        if (activity.type === 'BUY') {
          buyLots.push({
            currency,
            accountName,
            symbol,
            date: activityDate,
            fee: activity.fee,
            quantity: activity.quantity,
            unitPrice: activity.unitPrice
          });
          continue;
        }

        if (activityDate < startDate || activityDate > endDate) {
          continue;
        }

        if (activity.type === 'DIVIDEND') {
          const proceeds =
            activity.quantity * activity.unitPrice - activity.fee;

          items.push({
            currency,
            symbol,
            account: accountName,
            acquisitionDate: '',
            costBasis: 0,
            disposalDate: activityDate.toISOString(),
            gainLoss: Math.round(proceeds * 100) / 100,
            holdingPeriodInDays: 0,
            isLongTerm: false,
            proceeds: Math.round(proceeds * 100) / 100,
            quantity: activity.quantity,
            type: 'DIVIDEND'
          });
          continue;
        }

        // SELL — match against lots using chosen method
        let remainingToSell = activity.quantity;
        const sellPrice = activity.unitPrice;
        const sellDate = activityDate;
        const sellFee = activity.fee;
        const sellFeePerUnit =
          activity.quantity > 0 ? sellFee / activity.quantity : 0;

        while (remainingToSell > 0 && buyLots.length > 0) {
          const idx = costBasisMethod === 'LIFO' ? buyLots.length - 1 : 0;
          const lot = buyLots[idx];
          const matched = Math.min(remainingToSell, lot.quantity);
          const buyFeePerUnit = lot.quantity > 0 ? lot.fee / lot.quantity : 0;

          const costBasis = matched * lot.unitPrice + matched * buyFeePerUnit;
          const proceeds = matched * sellPrice - matched * sellFeePerUnit;
          const gainLoss = proceeds - costBasis;

          const holdingPeriodInDays = Math.floor(
            (sellDate.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24)
          );

          items.push({
            currency,
            symbol,
            account: accountName,
            acquisitionDate: lot.date.toISOString(),
            costBasis: Math.round(costBasis * 100) / 100,
            disposalDate: sellDate.toISOString(),
            gainLoss: Math.round(gainLoss * 100) / 100,
            holdingPeriodInDays,
            isLongTerm: holdingPeriodInDays >= LONG_TERM_THRESHOLD_DAYS,
            proceeds: Math.round(proceeds * 100) / 100,
            quantity: matched,
            type: 'SELL'
          });

          lot.quantity -= matched;
          lot.fee -= matched * buyFeePerUnit;
          remainingToSell -= matched;

          if (lot.quantity <= 0) {
            buyLots.splice(idx, 1);
          }
        }

        if (remainingToSell > 0) {
          const proceeds =
            remainingToSell * sellPrice - remainingToSell * sellFeePerUnit;

          items.push({
            currency,
            symbol,
            account: accountName,
            acquisitionDate: '',
            costBasis: 0,
            disposalDate: sellDate.toISOString(),
            gainLoss: Math.round(proceeds * 100) / 100,
            holdingPeriodInDays: 0,
            isLongTerm: false,
            proceeds: Math.round(proceeds * 100) / 100,
            quantity: remainingToSell,
            type: 'SELL'
          });
        }
      }
    }

    items.sort((a, b) => a.disposalDate.localeCompare(b.disposalDate));

    return items;
  }

  private static groupBySymbol(activities: ActivityRecord[]) {
    const bySymbol = new Map<string, ActivityRecord[]>();

    for (const activity of activities) {
      const symbol = activity.SymbolProfile.symbol;
      const list = bySymbol.get(symbol) ?? [];
      list.push(activity);
      bySymbol.set(symbol, list);
    }

    return bySymbol;
  }

  /**
   * Consumes quantity from a lot array using the given method.
   * Mutates the array in place.
   */
  private static consumeLots(
    lots: BuyLot[],
    quantityToConsume: number,
    method: CostBasisMethod
  ) {
    let remaining = quantityToConsume;

    while (remaining > 0 && lots.length > 0) {
      const idx = method === 'LIFO' ? lots.length - 1 : 0;
      const lot = lots[idx];
      const matched = Math.min(remaining, lot.quantity);
      const buyFeePerUnit = lot.quantity > 0 ? lot.fee / lot.quantity : 0;

      lot.quantity -= matched;
      lot.fee -= matched * buyFeePerUnit;
      remaining -= matched;

      if (lot.quantity <= 0) {
        lots.splice(idx, 1);
      }
    }
  }

  public async getTaxReport({
    costBasisMethod = 'FIFO',
    filters,
    taxYear,
    userId,
    userSettings
  }: {
    costBasisMethod?: CostBasisMethod;
    filters?: Filter[];
    taxYear: number;
    userId: string;
    userSettings: UserSettings;
  }): Promise<TaxReportResponse> {
    const startDate = new Date(`${taxYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${taxYear}-12-31T23:59:59.999Z`);

    const { activities, accountMap } = await this.fetchActivitiesAndAccounts({
      endDate,
      filters,
      userId,
      userSettings
    });

    const items = TaxReportService.computeTaxReportItems(
      activities,
      accountMap,
      startDate,
      endDate,
      costBasisMethod
    );

    const shortTermItems = items.filter((item) => !item.isLongTerm);
    const longTermItems = items.filter((item) => item.isLongTerm);

    const totalGainLoss = items.reduce((sum, item) => sum + item.gainLoss, 0);
    const shortTermGainLoss = shortTermItems.reduce(
      (sum, item) => sum + item.gainLoss,
      0
    );
    const longTermGainLoss = longTermItems.reduce(
      (sum, item) => sum + item.gainLoss,
      0
    );

    return {
      items,
      meta: {
        baseCurrency: userSettings?.baseCurrency ?? 'USD',
        costBasisMethod,
        date: new Date().toISOString(),
        taxYear,
        version: environment.version
      },
      summary: {
        longTermGainLoss: Math.round(longTermGainLoss * 100) / 100,
        shortTermGainLoss: Math.round(shortTermGainLoss * 100) / 100,
        totalGainLoss: Math.round(totalGainLoss * 100) / 100
      }
    };
  }

  private async fetchActivitiesAndAccounts({
    endDate,
    filters,
    userId,
    userSettings
  }: {
    endDate?: Date;
    filters?: Filter[];
    userId: string;
    userSettings: UserSettings;
  }) {
    const { activities } = await this.activitiesService.getActivities({
      endDate,
      filters,
      userId,
      includeDrafts: false,
      sortColumn: 'date',
      sortDirection: 'asc',
      types: ['BUY', 'SELL', 'DIVIDEND'] as ActivityType[],
      userCurrency: userSettings?.baseCurrency,
      withExcludedAccountsAndActivities: false
    });

    const accounts = await this.accountService.accounts({
      where: { userId },
      orderBy: { name: 'asc' }
    });

    const accountMap = new Map(
      accounts.map((account) => [account.id, account.name])
    );

    return { activities, accountMap };
  }
}

export interface ActivityRecord {
  accountId?: string;
  currency?: string;
  date: Date;
  fee: number;
  quantity: number;
  SymbolProfile: { currency?: string; symbol: string };
  type: string;
  unitPrice: number;
}
