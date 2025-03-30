import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('RequestValidation');
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Basic request validation - you can expand this as needed
    // Check for content-type for non-GET requests with bodies
    if (
      ['POST', 'PUT', 'PATCH'].includes(req.method) &&
      req.body &&
      Object.keys(req.body).length > 0 &&
      !req.headers['content-type']?.includes('application/json')
    ) {
      this.logger.warn(
        `Invalid content-type for ${req.method} request to ${req.url}`,
        { contentType: req.headers['content-type'] },
      );
    }

    // Check for extremely large payloads
    const contentLength =
      parseInt(req.headers['content-length'] as string, 10) || 0;
    if (contentLength > 10 * 1024 * 1024) {
      // 10MB
      this.logger.warn(
        `Large payload received: ${contentLength} bytes for ${req.method} ${req.url}`,
      );
    }

    // Add request timestamp for response time tracking
    req['timestamp'] = Date.now();

    next();
  }
}
