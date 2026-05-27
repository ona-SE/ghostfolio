import { IsCurrencyCode } from '@ghostfolio/common/validators/is-currency-code';

import { PlanFrequency } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class CreateRecurringInvestmentPlanDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsCurrencyCode()
  currency: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsEnum(PlanFrequency)
  frequency: PlanFrequency;

  @IsISO8601()
  startDate: string;

  @IsString()
  symbolProfileId: string;
}
