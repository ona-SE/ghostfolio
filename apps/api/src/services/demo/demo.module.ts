import { OrderRepositoryModule } from '@ghostfolio/api/services/order-repository/order-repository.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';

import { Module } from '@nestjs/common';

import { DemoService } from './demo.service';

@Module({
  exports: [DemoService],
  imports: [OrderRepositoryModule, PropertyModule],
  providers: [DemoService]
})
export class DemoModule {}
