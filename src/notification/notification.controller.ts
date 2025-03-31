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
import { Cache } from '../common/decorators/cache.decorator';

@ApiTags('notifications')
@Controller('notification')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('NotificationController');
  }

  @Get()
  @Cache({ ttl: 30, key: (request) => `notifications:${request.user.sub}` })
  @ApiOperation({ summary: 'Get all notifications for the authenticated user' })
  async getAllNotifications(@Req() req) {
    const userId = req.user.sub;
    this.logger.log(`Getting all notifications for user ${userId}`);
    return this.notificationService.getAllNotifications(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification for the authenticated user' })
  async createNotification(
    @Req() req,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    const userId = req.user.sub;
    this.logger.log(`Creating notification for user ${userId}`);
    return this.notificationService.createNotification(
      userId,
      createNotificationDto,
    );
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Req() req, @Param('id') id: string) {
    const userId = req.user.sub;
    this.logger.log(`Marking notification ${id} as read for user ${userId}`);
    return this.notificationService.markAsRead(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a specific notification' })
  async deleteNotification(@Req() req, @Param('id') id: string) {
    const userId = req.user.sub;
    this.logger.log(`Deleting notification ${id} for user ${userId}`);
    return this.notificationService.deleteNotification(id, userId);
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all notifications for the authenticated user',
  })
  async deleteAllNotifications(@Req() req) {
    const userId = req.user.sub;
    this.logger.log(`Deleting all notifications for user ${userId}`);
    return this.notificationService.deleteAllNotifications(userId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req) {
    const userId = req.user.sub;
    this.logger.log(`Marking all notifications as read for user ${userId}`);
    return this.notificationService.markAllAsRead(userId);
  }

  @Get('unread-count')
  @Cache({
    ttl: 15,
    key: (request) => `notifications:unread:${request.user.sub}`,
  })
  @ApiOperation({ summary: 'Get count of unread notifications' })
  async getUnreadCount(@Req() req) {
    const userId = req.user.sub;
    this.logger.debug(`Getting unread notification count for user ${userId}`);
    return this.notificationService.getUnreadCount(userId);
  }
}
