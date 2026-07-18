import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import { TransformDataSourceInRequestInterceptor } from '@ghostfolio/api/interceptors/transform-data-source-in-request/transform-data-source-in-request.interceptor';
import { ApiService } from '@ghostfolio/api/services/api/api.service';
import {
  CostBasisMethod,
  TaxReportResponse
} from '@ghostfolio/common/interfaces';
import type { RequestWithUser } from '@ghostfolio/common/types';

import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { TaxReportService } from './tax-report.service';

const VALID_METHODS: CostBasisMethod[] = ['FIFO', 'LIFO'];

function parseCostBasisMethod(raw?: string): CostBasisMethod {
  if (!raw) {
    return 'FIFO';
  }

  const upper = raw.toUpperCase() as CostBasisMethod;

  if (!VALID_METHODS.includes(upper)) {
    throw new BadRequestException(
      `Invalid costBasisMethod "${raw}". Must be one of: ${VALID_METHODS.join(', ')}`
    );
  }

  return upper;
}

@Controller('tax-report')
export class TaxReportController {
  public constructor(
    private readonly apiService: ApiService,
    private readonly taxReportService: TaxReportService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @UseInterceptors(TransformDataSourceInRequestInterceptor)
  public async getTaxReport(
    @Query('taxYear') taxYearParam: string,
    @Query('costBasisMethod') costBasisMethodParam?: string,
    @Query('accounts') filterByAccounts?: string,
    @Query('tags') filterByTags?: string
  ): Promise<TaxReportResponse> {
    const taxYear = taxYearParam
      ? parseInt(taxYearParam, 10)
      : new Date().getFullYear();

    const costBasisMethod = parseCostBasisMethod(costBasisMethodParam);

    const filters = this.apiService.buildFiltersFromQueryParams({
      filterByAccounts,
      filterByTags
    });

    return this.taxReportService.getTaxReport({
      costBasisMethod,
      filters,
      taxYear,
      userId: this.request.user.id,
      userSettings: this.request.user.settings.settings
    });
  }
}
