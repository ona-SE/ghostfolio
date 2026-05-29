import { AlertDirection, DataSource, WebhookType } from '@prisma/client';
import { IsEnum, IsNumber, IsString, IsUrl, Min } from 'class-validator';

export class CreatePriceAlertDto {
  @IsEnum(DataSource)
  dataSource: DataSource;

  @IsEnum(AlertDirection)
  direction: AlertDirection;

  @IsString()
  symbol: string;

  @IsNumber()
  @Min(0)
  thresholdPrice: number;

  @IsEnum(WebhookType)
  webhookType: WebhookType;

  @IsUrl()
  webhookUrl: string;
}
