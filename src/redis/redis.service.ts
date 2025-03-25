import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
  ) {}

  async incrementUnreadCount(
    userId: string,
    senderId: string,
  ): Promise<number> {
    try {
      const key = `unread_messages:${userId}:${senderId}`;
      const count = await this.redisClient.incr(key);
      this.logger.log(
        `Incremented unread messages for user ${userId} from ${senderId}: ${count}`,
      );
      return count;
    } catch (error) {
      this.logger.error(`Error incrementing unread count: ${error.message}`);
      throw error;
    }
  }

  async getUnreadCount(userId: string, senderId: string): Promise<number> {
    try {
      const key = `unread_messages:${userId}:${senderId}`;
      const count = await this.redisClient.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`);
      throw error;
    }
  }

  async resetUnreadCount(userId: string, senderId: string): Promise<void> {
    try {
      const key = `unread_messages:${userId}:${senderId}`;
      await this.redisClient.del(key);
      this.logger.log(
        `Reset unread messages for user ${userId} from ${senderId}`,
      );
    } catch (error) {
      this.logger.error(`Error resetting unread count: ${error.message}`);
      throw error;
    }
  }

  async getAllUnreadCounts(userId: string): Promise<Record<string, number>> {
    try {
      const pattern = `unread_messages:${userId}:*`;
      const keys = await this.redisClient.keys(pattern);

      const counts: Record<string, number> = {};
      for (const key of keys) {
        const [, , senderId] = key.split(':');
        const count = await this.redisClient.get(key);
        counts[senderId] = parseInt(count || '0', 10);
      }

      return counts;
    } catch (error) {
      this.logger.error(`Error getting all unread counts: ${error.message}`);
      throw error;
    }
  }
}
