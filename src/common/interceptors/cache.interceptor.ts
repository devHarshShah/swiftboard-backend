import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';
import { LoggerService } from '../../logger/logger.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_TAGS_METADATA,
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
    const isCacheableRequest = this.isCacheableRequest(request);

    // Skip caching for non-cacheable requests
    if (!isCacheableRequest) {
      return next.handle();
    }

    // Check if Redis is available
    try {
      const isRedisAvailable = await this.redisService.ping();
      if (!isRedisAvailable) {
        this.logger.warn('Redis is not available, bypassing cache');
        return next.handle();
      }
    } catch (error) {
      this.logger.warn(
        `Redis availability check failed: ${error.message}, bypassing cache`,
      );
      return next.handle();
    }

    // Get custom cache key if defined, or generate one
    const keyFn = this.reflector.get(CACHE_KEY_METADATA, context.getHandler());
    const ttl = this.reflector.get(CACHE_TTL_METADATA, context.getHandler());
    const tags =
      this.reflector.get(CACHE_TAGS_METADATA, context.getHandler()) || [];

    // Skip caching if TTL is 0 or undefined
    if (ttl === 0 || ttl === undefined) {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(request, keyFn);
    if (!cacheKey) {
      this.logger.debug('No cache key generated, bypassing cache');
      return next.handle();
    }

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
          // Don't cache undefined, null or error responses
          if (response !== undefined && response !== null) {
            // If the data needs to be cached with tags, use entity cache
            if (tags.length > 0) {
              const entityType = tags[0]; // Use first tag as entity type
              const entityId = this.extractEntityId(request, cacheKey);
              await this.redisService.cacheEntityData(
                entityType,
                entityId || 'all',
                response,
                ttl,
              );
              this.logger.debug(
                `Cached response for entity type ${entityType}:${entityId} with TTL ${ttl}s`,
              );
            } else {
              // Otherwise use standard caching
              await this.redisService.cacheData(cacheKey, response, ttl);
              this.logger.debug(
                `Cached response for ${cacheKey} with TTL ${ttl}s`,
              );
            }
          } else {
            this.logger.debug(
              `Not caching null/undefined response for ${cacheKey}`,
            );
          }
        }),
        catchError((error) => {
          this.logger.debug(`Not caching error response for ${cacheKey}`);
          throw error;
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

  private isCacheableRequest(request: any): boolean {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return false;
    }

    // Don't cache requests with specific headers
    if (request.headers['cache-control'] === 'no-cache') {
      return false;
    }

    // Don't cache authenticated admin requests to prevent privilege issues
    if (request.user?.isAdmin) {
      return false;
    }

    return true;
  }

  private generateCacheKey(request: any, keyFn: any): string | null {
    try {
      if (keyFn && typeof keyFn === 'function') {
        const generatedKey = keyFn(request);
        return generatedKey ? `api:cache:${generatedKey}` : null;
      }

      if (keyFn && typeof keyFn === 'string') {
        return `api:cache:${keyFn}`;
      }

      // Include authentication info in the cache key to prevent cross-user cache pollution
      const authPart = request.user?.id
        ? `:user:${request.user.id}`
        : request.user?.sub
          ? `:user:${request.user.sub}`
          : ':anonymous';

      // Default cache key based on URL and query parameters
      const url = request.originalUrl || request.url;
      return `api:cache:${request.method}:${url}${authPart}`;
    } catch (error) {
      this.logger.warn(`Error generating cache key: ${error.message}`);
      return null;
    }
  }

  private extractEntityId(request: any, cacheKey: string): string {
    // Try to extract ID from the request params
    if (request.params && Object.keys(request.params).length > 0) {
      // Return the first ID-like parameter found (common naming patterns)
      for (const key of Object.keys(request.params)) {
        if (
          key === 'id' ||
          key.endsWith('Id') ||
          key.endsWith('_id') ||
          key === 'uuid'
        ) {
          return request.params[key];
        }
      }
    }

    // If no ID found in params, extract from the cache key
    // Looking for patterns like ":id:" or ":userId:" in the cache key
    const idMatch = cacheKey.match(/:([^:]+):([^:]+)/);
    if (idMatch && idMatch.length >= 3) {
      return idMatch[2];
    }

    // Default to a hash of the cache key if no ID can be extracted
    return this.hashString(cacheKey);
  }

  private hashString(input: string): string {
    let hash = 0;
    if (input.length === 0) return hash.toString();

    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString();
  }
}
