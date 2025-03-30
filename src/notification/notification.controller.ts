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

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the authenticated user' })
  async getAllNotifications(@Req() req) {
    return this.notificationService.getAllNotifications(req.user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification for the authenticated user' })
  async createNotification(
    @Req() req,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    return this.notificationService.createNotification(
      req.user.sub,
      createNotificationDto,
    );
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Req() req, @Param('id') id: string) {
    return this.notificationService.markAsRead(id, req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a specific notification' })
  async deleteNotification(@Req() req, @Param('id') id: string) {
    return this.notificationService.deleteNotification(id, req.user.sub);
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all notifications for the authenticated user',
  })
  async deleteAllNotifications(@Req() req) {
    return this.notificationService.deleteAllNotifications(req.user.sub);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req) {
    return this.notificationService.markAllAsRead(req.user.sub);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  async getUnreadCount(@Req() req) {
    return this.notificationService.getUnreadCount(req.user.sub);
  }
}
