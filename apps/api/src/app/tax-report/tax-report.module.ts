import { AccountModule } from '@ghostfolio/api/app/account/account.module';
import { ActivitiesModule } from '@ghostfolio/api/app/activities/activities.module';
import { TransformDataSourceInRequestModule } from '@ghostfolio/api/interceptors/transform-data-source-in-request/transform-data-source-in-request.module';
import { ApiModule } from '@ghostfolio/api/services/api/api.module';

import { Module } from '@nestjs/common';

import { TaxReportController } from './tax-report.controller';
import { TaxReportService } from './tax-report.service';

@Module({
  controllers: [TaxReportController],
  imports: [
    AccountModule,
    ActivitiesModule,
    ApiModule,
    TransformDataSourceInRequestModule
  ],
  providers: [TaxReportService]
})
export class TaxReportModule {}
