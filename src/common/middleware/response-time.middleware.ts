import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class ResponseTimeMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('ResponseTimeMiddleware');
  }

  // This ensures the middleware function is properly bound to this instance
  get middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.use(req, res, next);
    };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Record start time
    const start = Date.now();

    // Store original end method
    const originalEnd = res.end;
    const originalWrite = res.write;
    let responseSize = 0;

    // Create a reference to logger that will be accessible within callbacks
    const logger = this.logger;

    // Flag to track if we've already logged the response
    let isResponseLogged = false;

    // Override write to track response size
    res.write = (...args: any[]) => {
      if (args[0]) {
        const chunk = args[0];
        if (Buffer.isBuffer(chunk)) {
          responseSize += chunk.length;
        } else if (typeof chunk === 'string') {
          responseSize += Buffer.byteLength(chunk);
        }
      }
      return originalWrite.apply(res, args);
    };

    // Track when the response is being sent
    res.end = (...args: any[]) => {
      // Calculate duration
      const duration = Date.now() - start;

      // Add header if headers haven't been sent yet
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration}ms`);
      }

      // Log response info after it's sent
      const method = req.method;
      const url = req.originalUrl || req.url;
      const status = res.statusCode;

      // Call original end method first
      const result = originalEnd.apply(res, args);

      // Only log once to prevent duplicate logs
      if (!isResponseLogged) {
        isResponseLogged = true;

        logger.log(
          `Response sent ${method} ${url} ${duration}ms`,
          JSON.stringify({
            responseTime: duration,
            responseSize: responseSize,
            statusCode: status,
          }),
        );
      }

      return result;
    };

    next();
  }
}
