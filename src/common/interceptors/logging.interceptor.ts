import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = request.user?.userId || 'anonymous';

    const requestInfo = {
      method,
      url,
      userId,
      userAgent,
    };

    // Don't log sensitive information or large objects
    if (method !== 'GET' && Object.keys(body || {}).length > 0) {
      // Optionally add sanitized request body info
      if (!url.includes('/auth')) {
        requestInfo['body'] = this.sanitizeData(body);
      } else {
        requestInfo['body'] = '**credentials**';
      }
    }

    const startTime = Date.now();
    this.logger.log(
      `Request received ${method} ${url}`,
      JSON.stringify(requestInfo),
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;

          // Sanitize the response for logging
          const sanitizedResponse = this.sanitizeData(data);

          this.logger.log(
            `Response sent ${method} ${url} ${responseTime}ms`,
            JSON.stringify({
              responseTime,
              responseSize: JSON.stringify(sanitizedResponse).length,
            }),
          );
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          this.logger.debug(
            `Request failed ${method} ${url} ${responseTime}ms`,
            JSON.stringify({
              responseTime,
              errorName: error.name,
              errorMessage: error.message,
            }),
          );
        },
      }),
    );
  }

  private sanitizeData(data: any): any {
    // Don't process null or undefined
    if (data === null || data === undefined) {
      return data;
    }

    // Handle non-objects
    if (typeof data !== 'object') {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      if (data.length > 10) {
        return `Array[${data.length}]`;
      }
      return data.map((item) => this.sanitizeData(item));
    }

    // Handle objects
    const sanitized = {};

    // List of sensitive fields to redact
    const sensitiveFields = [
      'password',
      'token',
      'refreshToken',
      'secret',
      'credentials',
    ];

    for (const key of Object.keys(data)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '**redacted**';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        sanitized[key] = this.sanitizeData(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }

    return sanitized;
  }
}
