import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateNotificationDto } from './dto/notification.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoggerService } from '../logger/logger.service';
import { ShortCache, NoCache } from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';

@ApiTags('notifications')
@Controller('notification')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
    private readonly redisService: RedisService,
  ) {
    this.logger.setContext('NotificationController');
  }

  @Get()
  @ShortCache({
    ttl: 15, // Reduce from 30 to 15 since notifications are time-sensitive
    key: (request) => `notifications:${request.user.sub}`,
  })
  @ApiOperation({ summary: 'Get all notifications for the authenticated user' })
  async getAllNotifications(@Req() req) {
    const userId = req.user.sub;
    this.logger.log(`Getting all notifications for user ${userId}`);
    return this.notificationService.getAllNotifications(userId);
  }

  @Post()
  @NoCache()
  @ApiOperation({ summary: 'Create a notification for the authenticated user' })
  async createNotification(
    @Req() req,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    const userId = req.user.sub;
    this.logger.log(`Creating notification for user ${userId}`);

    const result = await this.notificationService.createNotification(
      userId,
      createNotificationDto,
    );

    // Invalidate notification caches
    await this.invalidateNotificationCaches(userId);

    return result;
  }

  @Post(':id/read')
  @NoCache()
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Req() req, @Param('id') id: string) {
    const userId = req.user.sub;
    this.logger.log(`Marking notification ${id} as read for user ${userId}`);

    const result = await this.notificationService.markAsRead(id, userId);

    // Invalidate notification caches
    await this.invalidateNotificationCaches(userId);

    return result;
  }

  @Delete(':id')
  @NoCache()
  @ApiOperation({ summary: 'Delete a specific notification' })
  async deleteNotification(@Req() req, @Param('id') id: string) {
    const userId = req.user.sub;
    this.logger.log(`Deleting notification ${id} for user ${userId}`);

    const result = await this.notificationService.deleteNotification(
      id,
      userId,
    );

    // Invalidate notification caches
    await this.invalidateNotificationCaches(userId);

    return result;
  }

  @Delete()
  @NoCache()
  @ApiOperation({
    summary: 'Delete all notifications for the authenticated user',
  })
  async deleteAllNotifications(@Req() req) {
    const userId = req.user.sub;
    this.logger.log(`Deleting all notifications for user ${userId}`);

    const result =
      await this.notificationService.deleteAllNotifications(userId);

    // Invalidate notification caches
    await this.invalidateNotificationCaches(userId);

    return result;
  }

  @Post('read-all')
  @NoCache()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req) {
    const userId = req.user.sub;
    this.logger.log(`Marking all notifications as read for user ${userId}`);

    const result = await this.notificationService.markAllAsRead(userId);

    // Invalidate notification caches
    await this.invalidateNotificationCaches(userId);

    return result;
  }

  @Get('unread-count')
  @ShortCache({
    ttl: 10, // Even shorter TTL for just count
    key: (request) => `notifications:unread:${request.user.sub}`,
  })
  @ApiOperation({ summary: 'Get count of unread notifications' })
  async getUnreadCount(@Req() req) {
    const userId = req.user.sub;
    this.logger.debug(`Getting unread notification count for user ${userId}`);
    return this.notificationService.getUnreadCount(userId);
  }

  // Helper method for notification cache invalidation
  private async invalidateNotificationCaches(userId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*notifications:${userId}*`);
    await this.redisService.invalidateCachePattern(
      `*notifications:unread:${userId}*`,
    );
  }
}
