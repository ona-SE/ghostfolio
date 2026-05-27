import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { RecurringInvestmentPlanController } from './recurring-investment-plan.controller';
import { RecurringInvestmentPlanService } from './recurring-investment-plan.service';

@Module({
  controllers: [RecurringInvestmentPlanController],
  exports: [RecurringInvestmentPlanService],
  imports: [PrismaModule],
  providers: [RecurringInvestmentPlanService]
})
export class RecurringInvestmentPlanModule {}
