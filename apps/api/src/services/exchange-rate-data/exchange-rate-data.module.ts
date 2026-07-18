import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';
import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { EcbModule } from '@ghostfolio/api/services/ecb/ecb.module';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { MarketDataModule } from '@ghostfolio/api/services/market-data/market-data.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';

import { Module } from '@nestjs/common';

@Module({
  exports: [ExchangeRateDataService],
  imports: [
    ConfigurationModule,
    DataProviderModule,
    EcbModule,
    MarketDataModule,
    PrismaModule,
    PropertyModule
  ],
  providers: [ExchangeRateDataService]
})
export class ExchangeRateDataModule {}
