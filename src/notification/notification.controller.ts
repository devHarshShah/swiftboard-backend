import { NotificationService } from './notification.service';
import {
  Controller,
  Param,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/users/decorators/user.decorator';

@Controller('notification')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all notifications for a user.' })
  async getAllNotifications(@GetUser() userId: string) {
    return this.notificationService.getAllNotifications(userId);
  }
}
