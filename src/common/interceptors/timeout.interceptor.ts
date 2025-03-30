import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerService,
    private readonly timeoutValue: number = 30000, // 30 seconds default
  ) {
    this.logger.setContext('TimeoutInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      timeout(this.timeoutValue),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.logger.warn(
            `Request timeout for ${request.method} ${request.url}`,
            { timeoutMs: this.timeoutValue },
          );
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${this.timeoutValue}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
