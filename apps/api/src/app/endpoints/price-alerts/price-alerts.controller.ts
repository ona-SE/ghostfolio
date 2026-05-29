import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import {
  CreatePriceAlertDto,
  UpdatePriceAlertDto
} from '@ghostfolio/common/dtos';
import { PriceAlertsResponse } from '@ghostfolio/common/interfaces';
import { permissions } from '@ghostfolio/common/permissions';
import { RequestWithUser } from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import { PriceAlertsService } from './price-alerts.service';

@Controller('price-alerts')
export class PriceAlertsController {
  public constructor(
    @Inject(REQUEST) private readonly request: RequestWithUser,
    private readonly priceAlertsService: PriceAlertsService
  ) {}

  @Post()
  @HasPermission(permissions.createPriceAlert)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createPriceAlert(@Body() data: CreatePriceAlertDto) {
    return this.priceAlertsService.createPriceAlert({
      dataSource: data.dataSource,
      direction: data.direction,
      symbol: data.symbol,
      thresholdPrice: data.thresholdPrice,
      userId: this.request.user.id,
      webhookType: data.webhookType,
      webhookUrl: data.webhookUrl
    });
  }

  @Delete(':id')
  @HasPermission(permissions.deletePriceAlert)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async deletePriceAlert(@Param('id') id: string) {
    const alerts = await this.priceAlertsService.getPriceAlerts(
      this.request.user.id
    );

    const alert = alerts.find((a) => a.id === id);

    if (!alert) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    return this.priceAlertsService.deletePriceAlert({
      id,
      userId: this.request.user.id
    });
  }

  @Get()
  @HasPermission(permissions.readPriceAlerts)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getPriceAlerts(): Promise<PriceAlertsResponse> {
    const priceAlerts = await this.priceAlertsService.getPriceAlerts(
      this.request.user.id
    );

    return { priceAlerts };
  }

  @Patch(':id')
  @HasPermission(permissions.updatePriceAlert)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updatePriceAlert(
    @Param('id') id: string,
    @Body() data: UpdatePriceAlertDto
  ) {
    const alerts = await this.priceAlertsService.getPriceAlerts(
      this.request.user.id
    );

    const alert = alerts.find((a) => a.id === id);

    if (!alert) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    return this.priceAlertsService.updatePriceAlert({
      id,
      userId: this.request.user.id,
      ...data
    });
  }
}
