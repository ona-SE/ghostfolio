import { AlertDirection, DataSource, WebhookType } from '@prisma/client';

export interface PriceAlertItem {
  createdAt: Date;
  dataSource: DataSource;
  direction: AlertDirection;
  id: string;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  name?: string;
  symbol: string;
  thresholdPrice: number;
  webhookType: WebhookType;
  webhookUrl: string;
}

export interface PriceAlertsResponse {
  priceAlerts: PriceAlertItem[];
}
