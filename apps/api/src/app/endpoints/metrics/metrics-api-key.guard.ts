import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable
} from '@nestjs/common';
import { Request } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

const METRICS_API_KEY_HEADER = 'x-metrics-api-key';

@Injectable()
export class MetricsApiKeyGuard implements CanActivate {
  public constructor(
    private readonly configurationService: ConfigurationService
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers[METRICS_API_KEY_HEADER] as string;
    const expectedKey = this.configurationService.get('API_KEY_METRICS');

    if (!expectedKey) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED
      );
    }

    return true;
  }
}
