import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  public readonly httpRequestCount: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly dataProviderRequestCount: Counter;
  public readonly cacheOperationCount: Counter;

  public constructor() {
    this.registry = new Registry();

    this.httpRequestCount = new Counter({
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'] as const,
      name: 'ghostfolio_http_requests_total',
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'] as const,
      name: 'ghostfolio_http_request_duration_seconds',
      registers: [this.registry]
    });

    this.dataProviderRequestCount = new Counter({
      help: 'Total number of data provider requests',
      labelNames: ['provider'] as const,
      name: 'ghostfolio_data_provider_requests_total',
      registers: [this.registry]
    });

    this.cacheOperationCount = new Counter({
      help: 'Total number of cache operations',
      labelNames: ['operation'] as const,
      name: 'ghostfolio_cache_operations_total',
      registers: [this.registry]
    });
  }

  public onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public getContentType(): string {
    return this.registry.contentType;
  }
}
