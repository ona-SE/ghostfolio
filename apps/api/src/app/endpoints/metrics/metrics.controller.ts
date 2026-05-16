import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { MetricsApiKeyGuard } from './metrics-api-key.guard';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  public constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @UseGuards(MetricsApiKeyGuard)
  public async getMetrics(@Res() response: Response) {
    const metrics = await this.metricsService.getMetrics();

    response.set('Content-Type', this.metricsService.getContentType());

    return response.send(metrics);
  }
}
