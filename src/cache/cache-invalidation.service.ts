import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class CacheInvalidationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('CacheInvalidationService');
  }

  /**
   * Invalidate caches when a new workflow is created
   */
  async invalidateOnWorkflowCreated(
    workflowId: string,
    userId: string,
  ): Promise<void> {
    this.logger.debug(
      `Invalidating caches for new workflow ${workflowId} by user ${userId}`,
    );

    try {
      await this.redisService.invalidateRelatedCaches(
        { type: 'workflow', id: workflowId },
        [
          { type: 'user-workflows', id: userId }, // User's workflow list
          { type: 'workflows' }, // All workflows list if that exists
          { type: 'dashboard', id: userId }, // User's dashboard if cached
        ],
      );

      // Also invalidate any API response caches that might contain workflow lists
      await this.redisService.invalidateCachePattern(
        `api:cache:GET:*/workflows*`,
      );
      await this.redisService.invalidateCachePattern(
        `api:cache:GET:*/users/${userId}/workflows*`,
      );

      this.logger.log(
        `Successfully invalidated caches for new workflow ${workflowId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate caches for workflow ${workflowId}: ${error.message}`,
        error.stack,
      );
      // Don't rethrow - cache invalidation should not break the main flow
    }
  }

  /**
   * Invalidate caches when a workflow is updated
   */
  async invalidateOnWorkflowUpdated(
    workflowId: string,
    userId: string,
  ): Promise<void> {
    this.logger.debug(`Invalidating caches for updated workflow ${workflowId}`);

    try {
      await this.redisService.invalidateRelatedCaches(
        { type: 'workflow', id: workflowId },
        [{ type: 'user-workflows', id: userId }, { type: 'workflows' }],
      );

      // Invalidate API caches that might contain this workflow
      await this.redisService.invalidateCachePattern(
        `api:cache:GET:*/workflows/${workflowId}*`,
      );

      this.logger.log(
        `Successfully invalidated caches for updated workflow ${workflowId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate caches for workflow update ${workflowId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Invalidate user-related caches
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    this.logger.debug(`Invalidating caches for user ${userId}`);

    try {
      await this.redisService.invalidateRelatedCaches(
        { type: 'user', id: userId },
        [
          { type: 'user-workflows', id: userId },
          { type: 'dashboard', id: userId },
          { type: 'user-settings', id: userId },
        ],
      );

      // Also invalidate API response caches for this user
      await this.redisService.invalidateCachePattern(
        `api:cache:GET:*/users/${userId}*`,
      );

      this.logger.log(`Successfully invalidated caches for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate caches for user ${userId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
