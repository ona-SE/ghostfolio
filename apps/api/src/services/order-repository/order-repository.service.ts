import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { OrderWithAccount } from '@ghostfolio/common/types';

import { Injectable } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

@Injectable()
export class OrderRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async aggregate(
    args: Prisma.OrderAggregateArgs
  ): Promise<Prisma.GetOrderAggregateType<typeof args>> {
    return this.prismaService.order.aggregate(args) as any;
  }

  public async count(args?: Prisma.OrderCountArgs): Promise<number> {
    return this.prismaService.order.count(args);
  }

  public async create<T extends Prisma.OrderCreateArgs>(
    args: T
  ): Promise<Prisma.OrderGetPayload<T>> {
    return this.prismaService.order.create(args) as any;
  }

  public async createMany(
    args: Prisma.OrderCreateManyArgs
  ): Promise<Prisma.BatchPayload> {
    return this.prismaService.order.createMany(args);
  }

  public async delete(args: Prisma.OrderDeleteArgs): Promise<Order> {
    return this.prismaService.order.delete(args);
  }

  public async deleteMany(
    args: Prisma.OrderDeleteManyArgs
  ): Promise<Prisma.BatchPayload> {
    return this.prismaService.order.deleteMany(args);
  }

  public async findFirst(
    args?: Prisma.OrderFindFirstArgs
  ): Promise<Order | null> {
    return this.prismaService.order.findFirst(args);
  }

  public async findMany(params: {
    include?: Prisma.OrderInclude;
    skip?: number;
    take?: number;
    cursor?: Prisma.OrderWhereUniqueInput;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.Enumerable<Prisma.OrderOrderByWithRelationInput>;
  }): Promise<OrderWithAccount[]> {
    const { include, skip, take, cursor, where, orderBy } = params;

    return this.prismaService.order.findMany({
      cursor,
      include,
      orderBy,
      skip,
      take,
      where
    });
  }

  public async findUnique(
    args: Prisma.OrderFindUniqueArgs
  ): Promise<Order | null> {
    return this.prismaService.order.findUnique(args);
  }

  public async update(args: Prisma.OrderUpdateArgs): Promise<Order> {
    return this.prismaService.order.update(args);
  }
}
