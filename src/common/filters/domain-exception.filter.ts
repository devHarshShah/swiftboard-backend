import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../../logger/logger.service';
import { DomainException } from '../exceptions/domain.exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('DomainExceptionFilter');
  }

  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus?.() || HttpStatus.BAD_REQUEST;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      domain: exception.domain || 'application',
      message: exception.message,
      code: exception.code || 'DOMAIN_ERROR',
    };

    // Log with context
    this.logger.warn(
      `Domain Error: [${errorResponse.domain}] ${errorResponse.code} - ${errorResponse.message}`,
      {
        path: request.url,
        method: request.method,
      },
    );

    response.status(status).json(errorResponse);
  }
}
