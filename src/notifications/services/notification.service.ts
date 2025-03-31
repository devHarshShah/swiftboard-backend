import { Injectable, HttpStatus } from '@nestjs/common';
import { BaseService } from '../../common/services/base.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService extends BaseService {
  constructor(
    private prisma: PrismaService,
    private readonly emailService: any, // Assuming there's an email service
    logger: LoggerService,
  ) {
    super(logger);
  }

  async getUserNotifications(userId: string) {
    return this.executeDbOperation(
      () =>
        this.prisma.notification.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      'Failed to retrieve notifications',
      { userId },
    );
  }

  async markAsRead(notificationId: string, userId: string) {
    // First find the notification
    const notification = await this.executeDbOperation(
      () =>
        this.prisma.notification.findUnique({
          where: { id: notificationId },
        }),
      'Failed to find notification',
      { notificationId, userId },
    );

    // Validate notification belongs to user
    this.validateBusinessRule(
      notification !== null,
      'Notification not found',
      'NOTIFICATION_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    // At this point we know notification is not null
    this.validateBusinessRule(
      notification !== null && notification.userId === userId,
      'You do not have permission to update this notification',
      'NOTIFICATION_ACCESS_DENIED',
      HttpStatus.FORBIDDEN,
    );

    // Update the notification
    return this.executeDbOperation(
      () =>
        this.prisma.notification.update({
          where: { id: notificationId },
          data: { read: true },
        }),
      'Failed to update notification',
      { notificationId, userId },
    );
  }

  async sendNotification(userId: string, data: any) {
    // Create notification in database
    const notification = await this.executeDbOperation(
      () =>
        this.prisma.notification.create({
          data: {
            userId,
            message: data.body, // Assuming the schema uses 'message' instead of 'body'
            type: data.type,
          },
        }),
      'Failed to create notification',
      { userId, notificationData: data },
    );

    // Send email notification if needed
    if (data.sendEmail) {
      await this.executeExternalServiceCall(
        () =>
          this.emailService.sendEmail({
            to: data.email,
            subject: data.title,
            text: data.body,
          }),
        'Email Service',
        'send notification email',
        { userId, notificationId: notification.id },
      );
    }

    return notification;
  }
}
