import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

interface RateLimitOptions {
  points: number; // Number of requests
  duration: number; // Time window in seconds
  errorMessage: string;
  keyPrefix: string;
}

const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  points: 10,
  duration: 60,
  errorMessage: 'Too many requests, please try again later.',
  keyPrefix: 'rl',
};

export const RateLimit = (options: Partial<RateLimitOptions> = {}) => {
  return (
    target: any,
    key?: string,
    descriptor?: TypedPropertyDescriptor<any>,
  ) => {
    const rateLimitOptions = {
      ...DEFAULT_RATE_LIMIT,
      ...options,
    };
    Reflect.defineMetadata(
      'rateLimit',
      rateLimitOptions,
      descriptor?.value || target,
    );
    return descriptor;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Get rate limit metadata
    const rateLimitOptions =
      this.reflector.get<RateLimitOptions>('rateLimit', handler) ||
      this.reflector.get<RateLimitOptions>('rateLimit', classRef) ||
      DEFAULT_RATE_LIMIT;

    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    // Get user ID if authenticated
    const userId = (request as any).user?.id || 'anonymous';

    // Create a unique key for this rate limit rule
    const key = `${rateLimitOptions.keyPrefix}:${handler.name}:${ip}:${userId}`;

    // Get current count
    const current = await this.redis.get(key);

    // If key doesn't exist, create it with count=1 and set expiry
    if (!current) {
      await this.redis.set(key, 1, 'EX', rateLimitOptions.duration);
      return true;
    }

    // Otherwise, increment the counter
    const count = parseInt(current, 10) + 1;

    // If count exceeds points, reject the request
    if (count > rateLimitOptions.points) {
      // Set remaining time header
      const ttl = await this.redis.ttl(key);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: rateLimitOptions.errorMessage,
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Otherwise, update the counter and allow the request
    await this.redis.set(key, count, 'EX', rateLimitOptions.duration);

    return true;
  }
}
