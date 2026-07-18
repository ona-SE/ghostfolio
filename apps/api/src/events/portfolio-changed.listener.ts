import { RedisCacheService } from '@ghostfolio/api/app/redis-cache/redis-cache.service';
import {
  PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE_PRIORITY_LOW,
  PORTFOLIO_SNAPSHOT_PROCESS_JOB_NAME,
  PORTFOLIO_SNAPSHOT_PROCESS_JOB_OPTIONS
} from '@ghostfolio/common/config';
import { PortfolioSnapshotService } from '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import ms from 'ms';

import { PortfolioChangedEvent } from './portfolio-changed.event';

@Injectable()
export class PortfolioChangedListener {
  private static readonly DEBOUNCE_DELAY = ms('5 seconds');

  private debounceTimers = new Map<string, NodeJS.Timeout>();

  public constructor(
    private readonly portfolioSnapshotService: PortfolioSnapshotService,
    private readonly prismaService: PrismaService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  @OnEvent(PortfolioChangedEvent.getName())
  handlePortfolioChangedEvent(event: PortfolioChangedEvent) {
    const userId = event.getUserId();

    const existingTimer = this.debounceTimers.get(userId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.debounceTimers.set(
      userId,
      setTimeout(() => {
        this.debounceTimers.delete(userId);

        void this.processPortfolioChanged({ userId });
      }, PortfolioChangedListener.DEBOUNCE_DELAY)
    );
  }

  private async processPortfolioChanged({ userId }: { userId: string }) {
    Logger.log(
      `Portfolio of user '${userId}' has changed`,
      'PortfolioChangedListener'
    );

    await this.redisCacheService.removePortfolioSnapshotsByUserId({ userId });

    // Proactively recompute the snapshot in the background so the next
    // request hits a warm cache instead of waiting for a full computation.
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        include: {
          settings: true
        }
      });

      const userSettings =
        (user?.settings?.settings as Record<string, any>) ?? {};
      const userCurrency = userSettings?.baseCurrency ?? 'USD';
      const calculationType = userSettings?.performanceCalculationType;

      if (calculationType) {
        await this.portfolioSnapshotService.addJobToQueue({
          data: {
            calculationType,
            filters: [],
            userCurrency,
            userId
          },
          name: PORTFOLIO_SNAPSHOT_PROCESS_JOB_NAME,
          opts: {
            ...PORTFOLIO_SNAPSHOT_PROCESS_JOB_OPTIONS,
            jobId: userId,
            priority: PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE_PRIORITY_LOW
          }
        });

        Logger.debug(
          `Queued background snapshot recomputation for user '${userId}'`,
          'PortfolioChangedListener'
        );
      }
    } catch (error) {
      Logger.error(
        `Failed to queue snapshot recomputation for user '${userId}': ${error.message}`,
        'PortfolioChangedListener'
      );
    }
  }
}
