import { AlertDirection, WebhookType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUrl,
  Min
} from 'class-validator';

export class UpdatePriceAlertDto {
  @IsEnum(AlertDirection)
  @IsOptional()
  direction?: AlertDirection;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  thresholdPrice?: number;

  @IsEnum(WebhookType)
  @IsOptional()
  webhookType?: WebhookType;

  @IsUrl()
  @IsOptional()
  webhookUrl?: string;
}
