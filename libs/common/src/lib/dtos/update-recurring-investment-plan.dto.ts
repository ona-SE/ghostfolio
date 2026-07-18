import { IsCurrencyCode } from '@ghostfolio/common/validators/is-currency-code';

import { PlanFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class UpdateRecurringInvestmentPlanDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsCurrencyCode()
  currency?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsEnum(PlanFrequency)
  frequency?: PlanFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsString()
  symbolProfileId?: string;
}
