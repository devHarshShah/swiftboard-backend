import { HttpStatus, Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import { BusinessException } from '../exceptions/business.exception';
import { DomainException } from '../exceptions/domain.exception';

@Injectable()
export class BaseService {
  constructor(protected readonly logger: LoggerService) {}

  /**
   * Safely executes a database operation and handles common errors
   */
  protected async executeDbOperation<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    contextData?: Record<string, any>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Log the error with context
      this.logger.error(
        `Database operation failed: ${errorMessage}`,
        error.stack,
        JSON.stringify({
          error: error.message,
          code: error.code,
          ...contextData,
        }),
      );

      // Handle specific database errors
      if (error.code?.startsWith('P')) {
        // Prisma specific errors
        if (error.code === 'P2002') {
          throw new BusinessException({
            message: 'A record with this information already exists',
            code: 'DUPLICATE_RECORD',
            status: HttpStatus.CONFLICT,
            details: { fields: error.meta?.target },
          });
        } else if (error.code === 'P2025') {
          throw new BusinessException({
            message: 'Record not found',
            code: 'RECORD_NOT_FOUND',
            status: HttpStatus.NOT_FOUND,
          });
        }
      }

      // Re-throw as a business exception for other DB errors
      throw new BusinessException({
        message: errorMessage,
        code: 'DATABASE_ERROR',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        details: contextData,
      });
    }
  }

  /**
   * Safely executes an external service call and handles common errors
   */
  protected async executeExternalServiceCall<T>(
    operation: () => Promise<T>,
    serviceName: string,
    operationName: string,
    contextData?: Record<string, any>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Log the error with context
      this.logger.error(
        `External service error: ${serviceName} - ${operationName}`,
        error.stack,
        JSON.stringify({
          error: error.message,
          ...contextData,
        }),
      );

      // Check if it's already a domain exception
      if (error instanceof DomainException) {
        throw error;
      }

      // Handle specific service errors
      if (error.name === 'RedisError' || error.message?.includes('Redis')) {
        throw new BusinessException({
          message: 'Cache service temporarily unavailable',
          code: 'CACHE_SERVICE_ERROR',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new BusinessException({
          message: `${serviceName} is currently unavailable`,
          code: 'SERVICE_UNAVAILABLE',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
      }

      // Re-throw as a business exception
      throw new BusinessException({
        message: `Error while ${operationName}`,
        code: `${serviceName.toUpperCase()}_ERROR`,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        details: contextData,
      });
    }
  }

  /**
   * Validates business logic and throws a BusinessException if invalid
   */
  protected validateBusinessRule(
    condition: boolean,
    message: string,
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ): void {
    if (!condition) {
      throw new BusinessException({
        message,
        code,
        status,
        details,
      });
    }
  }
}
