import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  PortfolioRebalancingResponse,
  RebalancingSuggestion
} from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import { AssetClass } from '@prisma/client';

import { PortfolioService } from './portfolio.service';

@Injectable()
export class RebalancingService {
  public constructor(
    private readonly portfolioService: PortfolioService,
    private readonly prismaService: PrismaService
  ) {}

  public async getRebalancingSuggestions({
    impersonationId,
    userId
  }: {
    impersonationId: string;
    userId: string;
  }): Promise<PortfolioRebalancingResponse> {
    const targetAllocations =
      await this.prismaService.targetAllocation.findMany({
        where: { userId }
      });

    if (targetAllocations.length === 0) {
      return {
        suggestions: [],
        totalInvestedValueInBaseCurrency: 0
      };
    }

    const { holdings } = await this.portfolioService.getDetails({
      impersonationId,
      userId
    });

    const suggestions = RebalancingService.computeSuggestions({
      holdings,
      targetAllocations: targetAllocations.map((ta) => ({
        assetClass: ta.assetClass,
        targetPercentage: ta.targetPercentage
      }))
    });

    return suggestions;
  }

  /**
   * Pure computation extracted for testability.
   * Accepts current holdings and target allocations, returns rebalancing
   * suggestions with drift and trade amounts.
   */
  public static computeSuggestions({
    holdings,
    targetAllocations
  }: {
    holdings: Record<
      string,
      { assetClass?: AssetClass; valueInBaseCurrency?: number }
    >;
    targetAllocations: { assetClass: AssetClass; targetPercentage: number }[];
  }): PortfolioRebalancingResponse {
    // Aggregate current value by asset class (exclude LIQUIDITY)
    const valueByAssetClass: Partial<Record<AssetClass, number>> = {};
    let totalInvestedValueInBaseCurrency = 0;

    for (const position of Object.values(holdings)) {
      if (
        position.assetClass === AssetClass.LIQUIDITY ||
        !position.assetClass
      ) {
        continue;
      }

      const value = position.valueInBaseCurrency ?? 0;
      totalInvestedValueInBaseCurrency += value;

      valueByAssetClass[position.assetClass] =
        (valueByAssetClass[position.assetClass] ?? 0) + value;
    }

    if (totalInvestedValueInBaseCurrency === 0) {
      return {
        suggestions: targetAllocations.map((ta) => ({
          assetClass: ta.assetClass,
          currentPercentage: 0,
          currentValueInBaseCurrency: 0,
          deltaPercentage: ta.targetPercentage,
          deltaValueInBaseCurrency: 0,
          targetPercentage: ta.targetPercentage
        })),
        totalInvestedValueInBaseCurrency: 0
      };
    }

    const suggestions: RebalancingSuggestion[] = targetAllocations.map(
      ({ assetClass, targetPercentage }) => {
        const currentValue = valueByAssetClass[assetClass] ?? 0;
        const currentPercentage =
          currentValue / totalInvestedValueInBaseCurrency;
        const deltaPercentage = targetPercentage - currentPercentage;
        const deltaValueInBaseCurrency =
          deltaPercentage * totalInvestedValueInBaseCurrency;

        return {
          assetClass,
          currentPercentage,
          currentValueInBaseCurrency: currentValue,
          deltaPercentage,
          deltaValueInBaseCurrency,
          targetPercentage
        };
      }
    );

    return {
      suggestions,
      totalInvestedValueInBaseCurrency
    };
  }

  public async setTargetAllocations({
    allocations,
    userId
  }: {
    allocations: { assetClass: AssetClass; targetPercentage: number }[];
    userId: string;
  }): Promise<void> {
    // Validate: percentages must sum to 1 (within tolerance)
    const sum = allocations.reduce((s, a) => s + a.targetPercentage, 0);

    if (Math.abs(sum - 1) > 0.001) {
      throw new Error(
        `Target allocation percentages must sum to 100% (got ${(sum * 100).toFixed(1)}%)`
      );
    }

    // Validate: no negative percentages
    if (allocations.some((a) => a.targetPercentage < 0)) {
      throw new Error('Target allocation percentages must not be negative');
    }

    // Delete existing allocations and insert new ones in a transaction
    await this.prismaService.$transaction([
      this.prismaService.targetAllocation.deleteMany({
        where: { userId }
      }),
      ...allocations.map((allocation) =>
        this.prismaService.targetAllocation.create({
          data: {
            assetClass: allocation.assetClass,
            targetPercentage: allocation.targetPercentage,
            userId
          }
        })
      )
    ]);
  }

  public async getTargetAllocations({ userId }: { userId: string }) {
    return this.prismaService.targetAllocation.findMany({
      where: { userId },
      orderBy: { assetClass: 'asc' }
    });
  }
}
