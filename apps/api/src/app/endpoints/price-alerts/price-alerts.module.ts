import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { PriceAlertsController } from './price-alerts.controller';
import { PriceAlertsService } from './price-alerts.service';

@Module({
  controllers: [PriceAlertsController],
  exports: [PriceAlertsService],
  imports: [DataProviderModule, PrismaModule],
  providers: [PriceAlertsService]
})
export class PriceAlertsModule {}
