import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
  });

  it('should return Prometheus-formatted metrics', async () => {
    const metrics = await service.getMetrics();

    expect(metrics).toContain('ghostfolio_http_requests_total');
    expect(metrics).toContain('ghostfolio_http_request_duration_seconds');
    expect(metrics).toContain('ghostfolio_data_provider_requests_total');
    expect(metrics).toContain('ghostfolio_cache_operations_total');
  });

  it('should return a valid content type', () => {
    const contentType = service.getContentType();

    expect(contentType).toContain('text/plain');
  });

  it('should increment http request count', async () => {
    service.httpRequestCount.inc({
      method: 'GET',
      path: '/api/v1/portfolio',
      status_code: '200'
    });

    const metrics = await service.getMetrics();

    expect(metrics).toContain(
      'ghostfolio_http_requests_total{method="GET",path="/api/v1/portfolio",status_code="200"} 1'
    );
  });

  it('should observe http request duration', async () => {
    service.httpRequestDuration.observe(
      { method: 'GET', path: '/api/v1/health', status_code: '200' },
      0.123
    );

    const metrics = await service.getMetrics();

    expect(metrics).toContain('ghostfolio_http_request_duration_seconds_count');
    expect(metrics).toContain('ghostfolio_http_request_duration_seconds_sum');
    expect(metrics).toContain(
      'ghostfolio_http_request_duration_seconds_bucket'
    );
  });

  it('should increment data provider request count', async () => {
    service.dataProviderRequestCount.inc({ provider: 'YAHOO' });
    service.dataProviderRequestCount.inc({ provider: 'YAHOO' });

    const metrics = await service.getMetrics();

    expect(metrics).toContain(
      'ghostfolio_data_provider_requests_total{provider="YAHOO"} 2'
    );
  });

  it('should increment cache operation count', async () => {
    service.cacheOperationCount.inc({ operation: 'hit' });
    service.cacheOperationCount.inc({ operation: 'miss' });

    const metrics = await service.getMetrics();

    expect(metrics).toContain(
      'ghostfolio_cache_operations_total{operation="hit"} 1'
    );
    expect(metrics).toContain(
      'ghostfolio_cache_operations_total{operation="miss"} 1'
    );
  });

  it('should include default Node.js process metrics', async () => {
    const metrics = await service.getMetrics();

    expect(metrics).toContain('process_cpu_');
    expect(metrics).toContain('nodejs_heap_size_total_bytes');
  });
});
