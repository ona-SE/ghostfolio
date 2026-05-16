import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';

import { Module } from '@nestjs/common';

import { MetricsApiKeyGuard } from './metrics-api-key.guard';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  exports: [MetricsService],
  imports: [ConfigurationModule],
  providers: [MetricsApiKeyGuard, MetricsService]
})
export class MetricsModule {}
