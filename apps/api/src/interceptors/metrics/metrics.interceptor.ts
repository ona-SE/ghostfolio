import { MetricsService } from '@ghostfolio/api/app/endpoints/metrics/metrics.service';

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  public constructor(private readonly metricsService: MetricsService) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        complete: () => {
          this.recordMetrics(request, context, startTime);
        },
        error: () => {
          this.recordMetrics(request, context, startTime);
        }
      })
    );
  }

  private recordMetrics(
    request: Request,
    context: ExecutionContext,
    startTime: bigint
  ) {
    const response = context.switchToHttp().getResponse<Response>();
    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;

    // Normalize path to avoid high-cardinality labels
    const path = this.normalizePath(request.route?.path ?? request.path);
    const method = request.method;
    const statusCode = String(response.statusCode);

    this.metricsService.httpRequestCount.inc({
      method,
      path,
      status_code: statusCode
    });

    this.metricsService.httpRequestDuration.observe(
      { method, path, status_code: statusCode },
      durationSeconds
    );
  }

  private normalizePath(path: string): string {
    // Replace UUIDs and numeric IDs with placeholders
    return path
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id'
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  }
}
