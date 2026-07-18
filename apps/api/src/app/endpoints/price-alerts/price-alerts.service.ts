import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PriceAlertItem } from '@ghostfolio/common/interfaces';

import { Injectable, Logger } from '@nestjs/common';
import {
  AlertDirection,
  DataSource,
  PriceAlert,
  WebhookType
} from '@prisma/client';

@Injectable()
export class PriceAlertsService {
  public constructor(
    private readonly dataProviderService: DataProviderService,
    private readonly prismaService: PrismaService
  ) {}

  public async createPriceAlert({
    dataSource,
    direction,
    symbol,
    thresholdPrice,
    userId,
    webhookType,
    webhookUrl
  }: {
    dataSource: DataSource;
    direction: AlertDirection;
    symbol: string;
    thresholdPrice: number;
    userId: string;
    webhookType: WebhookType;
    webhookUrl: string;
  }): Promise<PriceAlert> {
    return this.prismaService.priceAlert.create({
      data: {
        dataSource,
        direction,
        symbol,
        thresholdPrice,
        userId,
        webhookType,
        webhookUrl
      }
    });
  }

  public async deletePriceAlert({
    id,
    userId
  }: {
    id: string;
    userId: string;
  }): Promise<PriceAlert> {
    return this.prismaService.priceAlert.delete({
      where: { id, userId }
    });
  }

  public async getPriceAlerts(userId: string): Promise<PriceAlertItem[]> {
    const alerts = await this.prismaService.priceAlert.findMany({
      where: { userId },
      include: {
        symbolProfile: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return alerts.map((alert) => ({
      createdAt: alert.createdAt,
      dataSource: alert.dataSource,
      direction: alert.direction,
      id: alert.id,
      isActive: alert.isActive,
      lastTriggeredAt: alert.lastTriggeredAt,
      name: alert.symbolProfile?.name ?? undefined,
      symbol: alert.symbol,
      thresholdPrice: alert.thresholdPrice,
      webhookType: alert.webhookType,
      webhookUrl: alert.webhookUrl
    }));
  }

  public async getActivePriceAlerts(): Promise<
    (PriceAlert & { symbolProfile: { name: string | null } })[]
  > {
    return this.prismaService.priceAlert.findMany({
      where: { isActive: true },
      include: {
        symbolProfile: { select: { name: true } }
      }
    });
  }

  public async updatePriceAlert({
    id,
    userId,
    ...data
  }: {
    id: string;
    userId: string;
    direction?: AlertDirection;
    isActive?: boolean;
    thresholdPrice?: number;
    webhookType?: WebhookType;
    webhookUrl?: string;
  }): Promise<PriceAlert> {
    return this.prismaService.priceAlert.update({
      data,
      where: { id, userId }
    });
  }

  public async checkPriceAlerts(): Promise<void> {
    const activeAlerts = await this.getActivePriceAlerts();

    if (activeAlerts.length === 0) {
      return;
    }

    // Deduplicate symbols to minimize API calls
    const uniqueSymbols = new Map<
      string,
      { dataSource: DataSource; symbol: string }
    >();

    for (const alert of activeAlerts) {
      const key = `${alert.dataSource}_${alert.symbol}`;

      if (!uniqueSymbols.has(key)) {
        uniqueSymbols.set(key, {
          dataSource: alert.dataSource,
          symbol: alert.symbol
        });
      }
    }

    const quotes = await this.dataProviderService.getQuotes({
      items: Array.from(uniqueSymbols.values())
    });

    const triggeredAlerts: {
      alert: (typeof activeAlerts)[0];
      currentPrice: number;
    }[] = [];

    for (const alert of activeAlerts) {
      const quote = quotes[alert.symbol];

      if (!quote?.marketPrice) {
        continue;
      }

      const currentPrice = quote.marketPrice;
      const isTriggered =
        (alert.direction === 'ABOVE' && currentPrice >= alert.thresholdPrice) ||
        (alert.direction === 'BELOW' && currentPrice <= alert.thresholdPrice);

      if (isTriggered) {
        triggeredAlerts.push({ alert, currentPrice });
      }
    }

    for (const { alert, currentPrice } of triggeredAlerts) {
      try {
        await this.fireWebhook({
          alertDirection: alert.direction,
          currentPrice,
          name: alert.symbolProfile?.name ?? alert.symbol,
          symbol: alert.symbol,
          thresholdPrice: alert.thresholdPrice,
          webhookType: alert.webhookType,
          webhookUrl: alert.webhookUrl
        });

        // Deactivate after firing to prevent repeated notifications
        await this.prismaService.priceAlert.update({
          data: { isActive: false, lastTriggeredAt: new Date() },
          where: { id: alert.id }
        });

        Logger.log(
          `Price alert triggered for ${alert.symbol}: ${alert.direction} ${alert.thresholdPrice} (current: ${currentPrice})`,
          'PriceAlertsService'
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        Logger.error(
          `Failed to fire webhook for alert ${alert.id}: ${message}`,
          'PriceAlertsService'
        );
      }
    }
  }

  private async fireWebhook({
    alertDirection,
    currentPrice,
    name,
    symbol,
    thresholdPrice,
    webhookType,
    webhookUrl
  }: {
    alertDirection: AlertDirection;
    currentPrice: number;
    name: string;
    symbol: string;
    thresholdPrice: number;
    webhookType: WebhookType;
    webhookUrl: string;
  }): Promise<void> {
    const directionLabel = alertDirection === 'ABOVE' ? 'above' : 'below';
    let body: string;
    let headers: Record<string, string>;

    switch (webhookType) {
      case 'DISCORD': {
        body = JSON.stringify({
          embeds: [
            {
              title: `Price Alert: ${name} (${symbol})`,
              description: `Price crossed ${directionLabel} **${thresholdPrice}**.\nCurrent price: **${currentPrice}**`,
              color: alertDirection === 'ABOVE' ? 0x36cfcc : 0xdc3545
            }
          ]
        });
        headers = { 'Content-Type': 'application/json' };
        break;
      }

      case 'SLACK': {
        body = JSON.stringify({
          text: `*Price Alert: ${name} (${symbol})*\nPrice crossed ${directionLabel} ${thresholdPrice}. Current price: ${currentPrice}`
        });
        headers = { 'Content-Type': 'application/json' };
        break;
      }

      case 'GENERIC':
      default: {
        body = JSON.stringify({
          alertDirection,
          currentPrice,
          name,
          symbol,
          thresholdPrice,
          triggeredAt: new Date().toISOString()
        });
        headers = { 'Content-Type': 'application/json' };
        break;
      }
    }

    const response = await fetch(webhookUrl, {
      body,
      headers,
      method: 'POST',
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      throw new Error(
        `Webhook returned ${response.status}: ${response.statusText}`
      );
    }
  }
}
