import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { OrderRepository } from './order-repository.service';

@Module({
  exports: [OrderRepository],
  imports: [PrismaModule],
  providers: [OrderRepository]
})
export class OrderRepositoryModule {}
