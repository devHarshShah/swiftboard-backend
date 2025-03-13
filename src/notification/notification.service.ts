import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(private prismaService: PrismaService) {}

  async getAllNotifications(userId: string) {
    return this.prismaService.notification.findMany({
      where: {
        userId: userId,
      },
    });
  }

  async createNotification(
    userId: string,
    createNotificationDto: CreateNotificationDto,
  ) {
    const { message, type } = createNotificationDto;
    return this.prismaService.notification.create({
      data: {
        userId: userId,
        message: message,
        type: type,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prismaService.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }
}
