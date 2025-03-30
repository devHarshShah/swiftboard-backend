import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('ErrorInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        // If it's already an HTTP exception, rethrow it
        if (err instanceof HttpException) {
          return throwError(() => err);
        }

        // Log the error
        this.logger.error(
          'Unhandled error caught by interceptor:',
          err?.stack || err,
        );

        // External service errors (like database, Redis, etc.)
        if (err.code) {
          let errorResponse;

          // Database specific errors
          if (err.code.startsWith('P')) {
            // Prisma error codes start with P
            this.logger.error(`Database error: ${err.code}`, err?.stack);
            errorResponse = {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Database operation failed',
              error: 'Database Error',
            };
          }
          // Redis errors
          else if (
            err.name === 'RedisError' ||
            err.message?.includes('Redis')
          ) {
            errorResponse = {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Caching service unavailable',
              error: 'Service Error',
            };
          }
          // Default for other external service errors
          else {
            errorResponse = {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Service temporarily unavailable',
              error: 'External Service Error',
            };
          }

          return throwError(
            () =>
              new HttpException(
                errorResponse,
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }

        // Convert all other errors to an internal server error
        return throwError(
          () =>
            new HttpException(
              {
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Internal server error',
                error: 'Internal Server Error',
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
        );
      }),
    );
  }
}
