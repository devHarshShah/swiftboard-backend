import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private logger: LoggerService,
  ) {
    this.logger.setContext('RedisService');
  }

  async incrementUnreadCount(
    userId: string,
    senderId: string,
  ): Promise<number> {
    try {
      const key = `unread_messages:${userId}:${senderId}`;
      this.logger.debug(`Incrementing unread count with key: ${key}`);

      const count = await this.redisClient.incr(key);

      this.logger.log(
        `Incremented unread messages for user ${userId} from ${senderId}: ${count}`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Error incrementing unread count: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUnreadCount(userId: string, senderId: string): Promise<number> {
    try {
      const key = `unread_messages:${userId}:${senderId}`;
      this.logger.debug(`Getting unread count with key: ${key}`);

      const count = await this.redisClient.get(key);
      const parsedCount = count ? parseInt(count, 10) : 0;

      this.logger.debug(
        `Retrieved unread count for user ${userId} from ${senderId}: ${parsedCount}`,
      );
      return parsedCount;
    } catch (error) {
      this.logger.error(
        `Error getting unread count: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async resetUnreadCount(userId: string, senderId: string): Promise<void> {
    try {
      const key = `unread_messages:${userId}:${senderId}`;
      this.logger.debug(`Resetting unread count with key: ${key}`);

      await this.redisClient.del(key);

      this.logger.log(
        `Reset unread messages for user ${userId} from ${senderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error resetting unread count: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAllUnreadCounts(userId: string): Promise<Record<string, number>> {
    try {
      const pattern = `unread_messages:${userId}:*`;
      this.logger.debug(`Looking up unread counts with pattern: ${pattern}`);

      const keys = await this.redisClient.keys(pattern);
      this.logger.debug(
        `Found ${keys.length} unread message keys for user ${userId}`,
      );

      const counts: Record<string, number> = {};
      for (const key of keys) {
        const [, , senderId] = key.split(':');
        const count = await this.redisClient.get(key);
        counts[senderId] = parseInt(count || '0', 10);
      }

      this.logger.debug(`Retrieved all unread counts for user ${userId}`);
      return counts;
    } catch (error) {
      this.logger.error(
        `Error getting all unread counts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async cacheData(key: string, data: any, ttlSeconds?: number): Promise<void> {
    try {
      this.logger.debug(`Caching data with key: ${key}`);

      const serializedData = JSON.stringify(data);

      if (ttlSeconds) {
        await this.redisClient.setex(key, ttlSeconds, serializedData);
        this.logger.debug(
          `Cached data with expiration of ${ttlSeconds} seconds`,
        );
      } else {
        await this.redisClient.set(key, serializedData);
        this.logger.debug(`Cached data without expiration`);
      }

      this.logger.log(`Successfully cached data for key: ${key}`);
    } catch (error) {
      this.logger.error(
        `Error caching data for key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      this.logger.debug(`Retrieving cached data for key: ${key}`);

      const data = await this.redisClient.get(key);

      if (!data) {
        this.logger.debug(`No cached data found for key: ${key}`);
        return null;
      }

      this.logger.debug(`Successfully retrieved cached data for key: ${key}`);
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(
        `Error retrieving cached data for key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async invalidateCache(key: string): Promise<void> {
    try {
      this.logger.debug(`Invalidating cache for key: ${key}`);

      await this.redisClient.del(key);

      this.logger.log(`Successfully invalidated cache for key: ${key}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating cache for key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async invalidateCachePattern(pattern: string): Promise<void> {
    try {
      this.logger.debug(`Invalidating cache with pattern: ${pattern}`);

      const keys = await this.redisClient.keys(pattern);
      this.logger.debug(
        `Found ${keys.length} keys matching pattern: ${pattern}`,
      );

      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(
          `Invalidated ${keys.length} keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error invalidating cache pattern ${pattern}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Invalidates all API response caches
   */
  async invalidateAllResponseCaches(): Promise<void> {
    try {
      this.logger.debug('Invalidating all API response caches');

      const pattern = 'api:cache:*';
      const keys = await this.redisClient.keys(pattern);

      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(`Invalidated ${keys.length} API response caches`);
      } else {
        this.logger.debug('No API response caches to invalidate');
      }
    } catch (error) {
      this.logger.error(
        `Error invalidating API response caches: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
