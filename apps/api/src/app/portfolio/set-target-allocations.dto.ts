import { AssetClass } from '@prisma/client';
import { IsArray, IsEnum, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TargetAllocationItem {
  @IsEnum(AssetClass)
  assetClass: AssetClass;

  @IsNumber()
  @Min(0)
  targetPercentage: number;
}

export class SetTargetAllocationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetAllocationItem)
  allocations: TargetAllocationItem[];
}
