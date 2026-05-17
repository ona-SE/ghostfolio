import { SubscriptionType } from '@ghostfolio/common/enums';

import {
  RATE_LIMIT_BASIC,
  RATE_LIMIT_PREMIUM,
  UserTierThrottlerGuard
} from './user-tier-throttler.guard';

// Access protected methods via a test subclass
class TestableUserTierThrottlerGuard extends UserTierThrottlerGuard {
  public constructor() {
    super([] as any, {} as any, {} as any);
  }

  public async testGetTracker(req: Record<string, any>): Promise<string> {
    return this.getTracker(req);
  }

  public async testHandleRequest(
    user: Record<string, any> | undefined
  ): Promise<{ limit: number; ttl: number }> {
    let capturedProps: { limit: number; ttl: number } | undefined;

    // Override super.handleRequest to capture the resolved limit/ttl
    (UserTierThrottlerGuard.prototype as any).__proto__.handleRequest = jest
      .fn()
      .mockImplementation(async (props: any) => {
        capturedProps = { limit: props.limit, ttl: props.ttl };

        return true;
      });

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user })
      })
    };

    await this.handleRequest({
      context: mockContext,
      limit: 0,
      ttl: 0,
      throttler: { limit: 0, ttl: 0 },
      blockDuration: 0,
      getTracker: this.getTracker.bind(this),
      generateKey: jest.fn()
    } as any);

    return capturedProps!;
  }
}

describe('UserTierThrottlerGuard', () => {
  let guard: TestableUserTierThrottlerGuard;

  beforeEach(() => {
    guard = new TestableUserTierThrottlerGuard();
  });

  describe('getTracker', () => {
    it('should return user ID for authenticated users', async () => {
      const tracker = await guard.testGetTracker({
        user: { id: 'user-123' }
      });

      expect(tracker).toBe('user-123');
    });

    it('should return IP for unauthenticated requests', async () => {
      const tracker = await guard.testGetTracker({
        ip: '192.168.1.1'
      });

      expect(tracker).toBe('192.168.1.1');
    });

    it('should fall back to connection remoteAddress', async () => {
      const tracker = await guard.testGetTracker({
        connection: { remoteAddress: '10.0.0.1' }
      });

      expect(tracker).toBe('10.0.0.1');
    });

    it('should return "unknown" when no identifier is available', async () => {
      const tracker = await guard.testGetTracker({});

      expect(tracker).toBe('unknown');
    });
  });

  describe('handleRequest', () => {
    it('should apply basic limit for free-tier users', async () => {
      const result = await guard.testHandleRequest({
        subscription: { type: SubscriptionType.Basic }
      });

      expect(result.limit).toBe(RATE_LIMIT_BASIC);
    });

    it('should apply premium limit for premium users', async () => {
      const result = await guard.testHandleRequest({
        subscription: { type: SubscriptionType.Premium }
      });

      expect(result.limit).toBe(RATE_LIMIT_PREMIUM);
    });

    it('should apply basic limit for unauthenticated requests', async () => {
      const result = await guard.testHandleRequest(undefined);

      expect(result.limit).toBe(RATE_LIMIT_BASIC);
    });

    it('should apply basic limit when subscription is missing', async () => {
      const result = await guard.testHandleRequest({ id: 'user-456' });

      expect(result.limit).toBe(RATE_LIMIT_BASIC);
    });
  });
});
