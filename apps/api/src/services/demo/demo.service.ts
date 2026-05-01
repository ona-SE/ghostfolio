import { OrderRepository } from '@ghostfolio/api/services/order-repository/order-repository.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import {
  PROPERTY_DEMO_ACCOUNT_ID,
  PROPERTY_DEMO_USER_ID,
  TAG_ID_DEMO
} from '@ghostfolio/common/config';

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Injectable()
export class DemoService {
  public constructor(
    private readonly orderRepository: OrderRepository,
    private readonly propertyService: PropertyService
  ) {}

  public async syncDemoUserAccount() {
    const [demoAccountId, demoUserId] = await Promise.all([
      this.propertyService.getByKey<string>(PROPERTY_DEMO_ACCOUNT_ID),
      this.propertyService.getByKey<string>(PROPERTY_DEMO_USER_ID)
    ]);

    let activities = await this.orderRepository.findMany({
      orderBy: {
        date: 'asc'
      },
      where: {
        tags: {
          some: {
            id: TAG_ID_DEMO
          }
        }
      }
    });

    activities = activities.map((activity) => {
      return {
        ...activity,
        accountId: demoAccountId,
        accountUserId: demoUserId,
        comment: null,
        id: randomUUID(),
        userId: demoUserId
      };
    });

    await this.orderRepository.deleteMany({
      where: {
        userId: demoUserId
      }
    });

    return this.orderRepository.createMany({
      data: activities
    });
  }
}
