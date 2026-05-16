import { MetricsService } from '@ghostfolio/api/app/endpoints/metrics/metrics.service';

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { MetricsInterceptor } from './metrics.interceptor';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
    interceptor = new MetricsInterceptor(metricsService);
  });

  function createMockContext(
    method: string,
    path: string,
    statusCode: number
  ): ExecutionContext {
    return {
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      getType: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          path,
          route: { path }
        }),
        getResponse: () => ({
          statusCode
        }),
        getNext: jest.fn()
      }),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn()
    } as unknown as ExecutionContext;
  }

  it('should increment request count on successful response', (done) => {
    const context = createMockContext('GET', '/api/v1/health', 200);
    const next: CallHandler = { handle: () => of('response') };

    const incSpy = jest.spyOn(metricsService.httpRequestCount, 'inc');
    const observeSpy = jest.spyOn(
      metricsService.httpRequestDuration,
      'observe'
    );

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(incSpy).toHaveBeenCalledWith({
          method: 'GET',
          path: '/api/v1/health',
          status_code: '200'
        });
        expect(observeSpy).toHaveBeenCalledWith(
          { method: 'GET', path: '/api/v1/health', status_code: '200' },
          expect.any(Number)
        );
        done();
      }
    });
  });

  it('should normalize UUID path segments', (done) => {
    const context = createMockContext(
      'GET',
      '/api/v1/user/550e8400-e29b-41d4-a716-446655440000/portfolio',
      200
    );
    const next: CallHandler = { handle: () => of('response') };

    const incSpy = jest.spyOn(metricsService.httpRequestCount, 'inc');

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(incSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            path: '/api/v1/user/:id/portfolio'
          })
        );
        done();
      }
    });
  });
});
