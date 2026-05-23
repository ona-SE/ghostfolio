import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { environment } from '@ghostfolio/api/environments/environment';
import {
  Filter,
  TaxReportItem,
  TaxReportResponse,
  UserSettings
} from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import { Type as ActivityType } from '@prisma/client';

@Injectable()
export class TaxReportService {
  public constructor(
    private readonly accountService: AccountService,
    private readonly activitiesService: ActivitiesService
  ) {}

  public async getTaxReport({
    filters,
    taxYear,
    userId,
    userSettings
  }: {
    filters?: Filter[];
    taxYear: number;
    userId: string;
    userSettings: UserSettings;
  }): Promise<TaxReportResponse> {
    const startDate = new Date(`${taxYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${taxYear}-12-31T23:59:59.999Z`);

    // Fetch all BUY/SELL/DIVIDEND activities up to end of tax year
    // (we need buys from before the tax year to match against sells within it)
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

    const items = TaxReportService.computeTaxReportItems(
      activities,
      accountMap,
      startDate,
      endDate
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

  /**
   * FIFO matching of BUY→SELL pairs per symbol, enriched with holding period
   * and long-term classification. Only disposals (SELL/DIVIDEND) within the
   * date range are included in the output.
   */
  public static computeTaxReportItems(
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
    accountMap: Map<string, string>,
    startDate: Date,
    endDate: Date
  ): TaxReportItem[] {
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

    const items: TaxReportItem[] = [];
    const LONG_TERM_THRESHOLD_DAYS = 365;

    for (const [symbol, symbolActivities] of bySymbol) {
      const buyQueue: BuyLot[] = [];

      for (const activity of symbolActivities) {
        const currency =
          activity.currency ?? activity.SymbolProfile.currency ?? '';
        const accountName = activity.accountId
          ? (accountMap.get(activity.accountId) ?? '')
          : '';
        const activityDate = activity.date;

        if (activity.type === 'BUY') {
          buyQueue.push({
            currency,
            accountName,
            date: activityDate,
            fee: activity.fee,
            quantity: activity.quantity,
            unitPrice: activity.unitPrice
          });
          continue;
        }

        // Only include disposals within the tax year
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

        // SELL — match against buy queue (FIFO)
        let remainingToSell = activity.quantity;
        const sellPrice = activity.unitPrice;
        const sellDate = activityDate;
        const sellFee = activity.fee;
        const sellFeePerUnit =
          activity.quantity > 0 ? sellFee / activity.quantity : 0;

        while (remainingToSell > 0 && buyQueue.length > 0) {
          const lot = buyQueue[0];
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
            buyQueue.shift();
          }
        }

        // Sells exceeding buys (short sales or missing data)
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

    // Sort by disposal date
    items.sort((a, b) => a.disposalDate.localeCompare(b.disposalDate));

    return items;
  }
}
