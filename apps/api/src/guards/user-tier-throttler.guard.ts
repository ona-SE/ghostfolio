import { SubscriptionType } from '@ghostfolio/common/enums';
import type { UserWithSettings } from '@ghostfolio/common/types';

import { Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage
} from '@nestjs/throttler';

export const RATE_LIMIT_BASIC = 100;
export const RATE_LIMIT_PREMIUM = 1000;
export const RATE_LIMIT_TTL = 3600000; // 1 hour in milliseconds

// Stricter limit for unauthenticated, abuse-prone public endpoints
export const RATE_LIMIT_PUBLIC_ENDPOINT = 100;
export const RATE_LIMIT_PUBLIC_ENDPOINT_TTL = 900000; // 15 minutes in milliseconds

export const RATE_LIMIT_PUBLIC_ENDPOINT_KEY = 'rateLimitPublicEndpoint';

/**
 * Applies a stricter, IP-based rate limit (100 requests / 15 minutes) to a
 * public endpoint, overriding the default user-tier limit.
 */
export const RateLimitPublicEndpoint = () =>
  SetMetadata(RATE_LIMIT_PUBLIC_ENDPOINT_KEY, true);

@Injectable()
export class UserTierThrottlerGuard extends ThrottlerGuard {
  public constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user as UserWithSettings | undefined;

    if (user?.id) {
      return user.id;
    }

    // Fall back to IP for unauthenticated requests
    return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest
  ): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest();
    const user = req.user as UserWithSettings | undefined;

    if (this.isPublicEndpoint(context)) {
      return super.handleRequest({
        ...requestProps,
        limit: RATE_LIMIT_PUBLIC_ENDPOINT,
        ttl: RATE_LIMIT_PUBLIC_ENDPOINT_TTL
      });
    }

    const limit = this.getLimitForUser(user);

    return super.handleRequest({
      ...requestProps,
      limit,
      ttl: RATE_LIMIT_TTL
    });
  }

  private isPublicEndpoint(context: ThrottlerRequest['context']): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(
        RATE_LIMIT_PUBLIC_ENDPOINT_KEY,
        [context.getHandler(), context.getClass()]
      ) ?? false
    );
  }

  private getLimitForUser(user?: UserWithSettings): number {
    if (user?.subscription?.type === SubscriptionType.Premium) {
      return RATE_LIMIT_PREMIUM;
    }

    return RATE_LIMIT_BASIC;
  }
}
