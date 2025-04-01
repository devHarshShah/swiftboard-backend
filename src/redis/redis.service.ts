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

  /**
   * Cache data with entity type prefixing for better organization
   */
  async cacheEntityData(
    entityType: string,
    entityId: string,
    data: any,
    ttlSeconds: number = 3600, // Default 1 hour TTL
  ): Promise<void> {
    try {
      const key = this.generateEntityCacheKey(entityType, entityId);
      this.logger.debug(`Caching entity data with key: ${key}`);

      // Store the data
      await this.cacheData(key, data, ttlSeconds);

      // Also register this key with the entity type for easier invalidation
      const indexKey = `entity-index:${entityType}`;
      await this.redisClient.sadd(indexKey, key);

      // Set expiration on the index to prevent memory leaks
      await this.redisClient.expire(indexKey, Math.max(ttlSeconds, 86400)); // At least 1 day

      this.logger.log(
        `Successfully cached entity data for ${entityType}:${entityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error caching entity data for ${entityType}:${entityId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get cached entity data
   */
  async getCachedEntityData<T>(
    entityType: string,
    entityId: string,
  ): Promise<T | null> {
    const key = this.generateEntityCacheKey(entityType, entityId);
    return this.getCachedData<T>(key);
  }

  /**
   * Invalidate cache for a specific entity
   */
  async invalidateEntityCache(
    entityType: string,
    entityId: string,
  ): Promise<void> {
    const key = this.generateEntityCacheKey(entityType, entityId);
    await this.invalidateCache(key);
  }

  /**
   * Invalidate all caches for a specific entity type
   */
  async invalidateEntityTypeCache(entityType: string): Promise<void> {
    try {
      this.logger.debug(
        `Invalidating all caches for entity type: ${entityType}`,
      );

      // Get all keys from the entity index
      const indexKey = `entity-index:${entityType}`;
      const keys = await this.redisClient.smembers(indexKey);

      if (keys.length > 0) {
        // Delete all the cached data
        await this.redisClient.del(...keys);
        // Clear the index
        await this.redisClient.del(indexKey);
        this.logger.log(
          `Invalidated ${keys.length} cache entries for entity type ${entityType}`,
        );
      } else {
        // Fallback to pattern matching if index is empty
        const pattern = `entity:${entityType}:*`;
        await this.invalidateCachePattern(pattern);
      }
    } catch (error) {
      this.logger.error(
        `Error invalidating entity type cache for ${entityType}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Invalidate related entity caches when an action occurs
   * For example, when a workflow is created, we may need to invalidate user workflows list
   */
  async invalidateRelatedCaches(
    primaryEntity: { type: string; id: string },
    relatedEntities: Array<{ type: string; id?: string }>,
  ): Promise<void> {
    // Invalidate the primary entity
    await this.invalidateEntityCache(primaryEntity.type, primaryEntity.id);

    // Invalidate related entities
    for (const entity of relatedEntities) {
      if (entity.id) {
        await this.invalidateEntityCache(entity.type, entity.id);
      } else {
        await this.invalidateEntityTypeCache(entity.type);
      }
    }
  }

  /**
   * Generate standard cache key for entities
   */
  private generateEntityCacheKey(entityType: string, entityId: string): string {
    return `entity:${entityType}:${entityId}`;
  }

  /**
   * Check if Redis is available
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis ping failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Safer invalidate pattern with error handling
   * If a pattern fails, it will still delete individual keys
   */
  async safeInvalidateCachePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern);
      this.logger.debug(
        `Found ${keys.length} keys matching pattern: ${pattern}`,
      );

      if (keys.length > 0) {
        // Delete each key individually to avoid Redis errors with large batches
        for (const key of keys) {
          try {
            await this.redisClient.del(key);
          } catch (error) {
            this.logger.error(`Error deleting key ${key}: ${error.message}`);
          }
        }
        this.logger.log(`Invalidated keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(
        `Error finding keys with pattern ${pattern}: ${error.message}`,
        error.stack,
      );
      // Don't rethrow to avoid breaking the calling code
    }
  }
}
