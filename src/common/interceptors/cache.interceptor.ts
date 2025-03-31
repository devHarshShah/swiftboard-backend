import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';
import { LoggerService } from '../../logger/logger.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from '../decorators/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('CacheInterceptor');
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Skip caching for non-GET requests by default
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Get custom cache key if defined, or generate one
    const keyFn = this.reflector.get(CACHE_KEY_METADATA, context.getHandler());
    const ttl = this.reflector.get(CACHE_TTL_METADATA, context.getHandler());

    // Skip if the endpoint is not configured for caching
    if (!ttl) {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(request, keyFn);
    this.logger.debug(`Checking cache for key: ${cacheKey}`);

    try {
      // Try to get from cache
      const cachedResponse = await this.redisService.getCachedData(cacheKey);
      if (cachedResponse) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return of(cachedResponse);
      }

      // If not in cache, execute handler and cache the result
      this.logger.debug(`Cache miss for ${cacheKey}`);
      return next.handle().pipe(
        tap(async (response) => {
          await this.redisService.cacheData(cacheKey, response, ttl);
          this.logger.debug(`Cached response for ${cacheKey} with TTL ${ttl}s`);
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Error during cache operations: ${error.message}. Bypassing cache.`,
      );
      // If any cache error occurs, bypass cache and return the response directly
      return next.handle();
    }
  }

  private generateCacheKey(request: any, keyFn: any): string {
    if (keyFn && typeof keyFn === 'function') {
      return `api:cache:${keyFn(request)}`;
    }

    if (keyFn && typeof keyFn === 'string') {
      return `api:cache:${keyFn}`;
    }

    // Default cache key based on URL and query parameters
    const url = request.originalUrl || request.url;
    return `api:cache:${request.method}:${url}`;
  }
}
