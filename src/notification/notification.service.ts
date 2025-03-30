import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private prismaService: PrismaService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('NotificationService');
  }

  async getAllNotifications(userId: string) {
    this.logger.log(`Fetching all notifications for user: ${userId}`);

    try {
      const notifications = await this.prismaService.notification.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      this.logger.debug(
        `Retrieved ${notifications.length} notifications for user: ${userId}`,
      );
      return notifications;
    } catch (error) {
      this.logger.error(
        `Error fetching notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createNotification(
    userId: string,
    createNotificationDto: CreateNotificationDto,
  ) {
    const { message, type } = createNotificationDto;
    this.logger.log(`Creating ${type} notification for user: ${userId}`);

    try {
      const notification = await this.prismaService.notification.create({
        data: {
          userId: userId,
          message: message,
          type: type,
        },
      });

      this.logger.debug(`Created notification with ID: ${notification.id}`);
      return notification;
    } catch (error) {
      this.logger.error(
        `Error creating notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    this.logger.log(
      `Marking notification ${notificationId} as read for user: ${userId}`,
    );

    try {
      const notification = await this.prismaService.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });

      this.logger.debug(`Notification ${notificationId} marked as read`);
      return notification;
    } catch (error) {
      this.logger.error(
        `Error marking notification as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string) {
    this.logger.log(
      `Deleting notification ${notificationId} for user: ${userId}`,
    );

    try {
      // First verify the notification belongs to this user
      const notification = await this.prismaService.notification.findFirst({
        where: {
          id: notificationId,
          userId: userId,
        },
      });

      if (!notification) {
        this.logger.warn(
          `Attempted to delete notification ${notificationId} not belonging to user ${userId}`,
        );
        return { success: false, message: 'Notification not found' };
      }

      await this.prismaService.notification.delete({
        where: { id: notificationId },
      });

      this.logger.debug(`Successfully deleted notification ${notificationId}`);
      return { success: true, message: 'Notification deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Error deleting notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteAllNotifications(userId: string) {
    this.logger.log(`Deleting all notifications for user: ${userId}`);

    try {
      const result = await this.prismaService.notification.deleteMany({
        where: { userId },
      });

      this.logger.debug(
        `Deleted ${result.count} notifications for user: ${userId}`,
      );
      return {
        success: true,
        message: `Successfully deleted ${result.count} notifications`,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting all notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    this.logger.log(`Marking all notifications as read for user: ${userId}`);

    try {
      const result = await this.prismaService.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: { read: true },
      });

      this.logger.debug(
        `Marked ${result.count} notifications as read for user: ${userId}`,
      );
      return {
        success: true,
        message: `Successfully marked ${result.count} notifications as read`,
      };
    } catch (error) {
      this.logger.error(
        `Error marking all notifications as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUnreadCount(userId: string) {
    this.logger.debug(`Getting unread notification count for user: ${userId}`);

    try {
      const count = await this.prismaService.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      this.logger.debug(`User ${userId} has ${count} unread notifications`);
      return { count };
    } catch (error) {
      this.logger.error(
        `Error getting unread notification count: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
