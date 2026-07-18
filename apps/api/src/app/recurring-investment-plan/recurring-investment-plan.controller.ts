import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import {
  CreateRecurringInvestmentPlanDto,
  UpdateRecurringInvestmentPlanDto
} from '@ghostfolio/common/dtos';
import { RecurringInvestmentPlansResponse } from '@ghostfolio/common/interfaces';
import { permissions } from '@ghostfolio/common/permissions';
import type { RequestWithUser } from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Put,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RecurringInvestmentPlan } from '@prisma/client';
import { parseISO } from 'date-fns';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import { RecurringInvestmentPlanService } from './recurring-investment-plan.service';

@Controller('recurring-investment-plan')
export class RecurringInvestmentPlanController {
  public constructor(
    private readonly recurringInvestmentPlanService: RecurringInvestmentPlanService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @HasPermission(permissions.createRecurringInvestmentPlan)
  @Post()
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createPlan(
    @Body() data: CreateRecurringInvestmentPlanDto
  ): Promise<RecurringInvestmentPlan> {
    const accountId = data.accountId;

    return this.recurringInvestmentPlanService.createPlan({
      amount: data.amount,
      comment: data.comment,
      currency: data.currency,
      endDate: data.endDate ? parseISO(data.endDate) : undefined,
      frequency: data.frequency,
      startDate: parseISO(data.startDate),
      ...(accountId && {
        account: {
          connect: {
            id_userId: { id: accountId, userId: this.request.user.id }
          }
        }
      }),
      SymbolProfile: { connect: { id: data.symbolProfileId } },
      user: { connect: { id: this.request.user.id } }
    });
  }

  @Delete(':id')
  @HasPermission(permissions.deleteRecurringInvestmentPlan)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async deletePlan(
    @Param('id') id: string
  ): Promise<RecurringInvestmentPlan> {
    const plan = await this.recurringInvestmentPlanService.getPlan({
      id,
      userId: this.request.user.id
    });

    if (!plan) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.recurringInvestmentPlanService.deletePlan({
      id,
      userId: this.request.user.id
    });
  }

  @Get()
  @HasPermission(permissions.readRecurringInvestmentPlan)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getPlans(): Promise<RecurringInvestmentPlansResponse> {
    const plans = await this.recurringInvestmentPlanService.getPlans({
      userId: this.request.user.id
    });

    return { plans };
  }

  @HasPermission(permissions.updateRecurringInvestmentPlan)
  @Put(':id')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updatePlan(
    @Param('id') id: string,
    @Body() data: UpdateRecurringInvestmentPlanDto
  ): Promise<RecurringInvestmentPlan> {
    const plan = await this.recurringInvestmentPlanService.getPlan({
      id,
      userId: this.request.user.id
    });

    if (!plan) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    const accountId = data.accountId;
    delete data.accountId;

    return this.recurringInvestmentPlanService.updatePlan({
      id,
      userId: this.request.user.id,
      data: {
        ...data,
        endDate: data.endDate ? parseISO(data.endDate) : undefined,
        startDate: data.startDate ? parseISO(data.startDate) : undefined,
        ...(accountId && {
          account: {
            connect: {
              id_userId: { id: accountId, userId: this.request.user.id }
            }
          }
        }),
        ...(data.symbolProfileId && {
          SymbolProfile: { connect: { id: data.symbolProfileId } }
        })
      }
    });
  }
}
