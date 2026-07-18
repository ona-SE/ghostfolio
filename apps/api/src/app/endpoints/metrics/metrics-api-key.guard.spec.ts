import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import { HttpException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { MetricsApiKeyGuard } from './metrics-api-key.guard';

describe('MetricsApiKeyGuard', () => {
  let guard: MetricsApiKeyGuard;
  let configurationService: Partial<ConfigurationService>;

  function createMockContext(apiKeyHeader?: string) {
    return new ExecutionContextHost([
      {
        headers: apiKeyHeader ? { 'x-metrics-api-key': apiKeyHeader } : {}
      }
    ]);
  }

  describe('when API_KEY_METRICS is configured', () => {
    beforeEach(() => {
      configurationService = {
        get: jest.fn().mockReturnValue('test-metrics-key')
      };
      guard = new MetricsApiKeyGuard(
        configurationService as ConfigurationService
      );
    });

    it('should allow access with a valid API key', () => {
      const context = createMockContext('test-metrics-key');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access with an invalid API key', () => {
      const context = createMockContext('wrong-key');

      expect(() => guard.canActivate(context)).toThrow(HttpException);
    });

    it('should deny access with no API key header', () => {
      const context = createMockContext();

      expect(() => guard.canActivate(context)).toThrow(HttpException);
    });
  });

  describe('when API_KEY_METRICS is not configured', () => {
    beforeEach(() => {
      configurationService = {
        get: jest.fn().mockReturnValue('')
      };
      guard = new MetricsApiKeyGuard(
        configurationService as ConfigurationService
      );
    });

    it('should return 404 when metrics key is not set', () => {
      const context = createMockContext('any-key');

      expect(() => guard.canActivate(context)).toThrow(HttpException);
    });
  });
});
