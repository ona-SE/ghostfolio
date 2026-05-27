import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import type { RecurringInvestmentPlan } from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import {
  Prisma,
  RecurringInvestmentPlan as RecurringInvestmentPlanModel
} from '@prisma/client';

@Injectable()
export class RecurringInvestmentPlanService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async createPlan(
    data: Prisma.RecurringInvestmentPlanCreateInput
  ): Promise<RecurringInvestmentPlanModel> {
    return this.prismaService.recurringInvestmentPlan.create({ data });
  }

  public async deletePlan({
    id,
    userId
  }: {
    id: string;
    userId: string;
  }): Promise<RecurringInvestmentPlanModel> {
    return this.prismaService.recurringInvestmentPlan.delete({
      where: { id, userId }
    });
  }

  public async getPlan({
    id,
    userId
  }: {
    id: string;
    userId: string;
  }): Promise<RecurringInvestmentPlanModel | null> {
    return this.prismaService.recurringInvestmentPlan.findFirst({
      where: { id, userId }
    });
  }

  public async getPlans({
    userId
  }: {
    userId: string;
  }): Promise<RecurringInvestmentPlan[]> {
    const plans = await this.prismaService.recurringInvestmentPlan.findMany({
      include: {
        account: { select: { name: true } },
        SymbolProfile: { select: { name: true, symbol: true } }
      },
      orderBy: { startDate: 'desc' },
      where: { userId }
    });

    return plans.map((plan) => ({
      accountId: plan.accountId,
      accountName: plan.account?.name,
      amount: plan.amount,
      comment: plan.comment,
      createdAt: plan.createdAt,
      currency: plan.currency,
      endDate: plan.endDate,
      frequency: plan.frequency,
      id: plan.id,
      isActive: plan.isActive,
      startDate: plan.startDate,
      symbolName: plan.SymbolProfile?.name ?? plan.SymbolProfile?.symbol,
      symbolProfileId: plan.symbolProfileId,
      updatedAt: plan.updatedAt,
      userId: plan.userId
    }));
  }

  public async updatePlan({
    data,
    id,
    userId
  }: {
    data: Prisma.RecurringInvestmentPlanUpdateInput;
    id: string;
    userId: string;
  }): Promise<RecurringInvestmentPlanModel> {
    return this.prismaService.recurringInvestmentPlan.update({
      data,
      where: { id, userId }
    });
  }
}
