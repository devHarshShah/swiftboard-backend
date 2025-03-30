import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { LoggerService } from '../logger/logger.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  namespace: 'notification',
  cors: {
    origin: '*', // Adjust for production
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(
    private notificationService: NotificationService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('NotificationGateway');
  }

  afterInit(server: Server) {
    this.logger.log('Notification Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      if (!userId || userId === 'undefined') {
        this.logger.warn(
          `Invalid userId during connection for client: ${client.id}`,
        );
        client.disconnect(true);
        return;
      }

      this.logger.log(`Client connected: ${client.id} for user: ${userId}`);
      this.logger.debug(
        `Connection details: IP=${client.handshake.address}, transport=${client.conn.transport.name}`,
      );

      // Store the socket-user association
      const existingSockets = this.userSockets.get(userId) || [];
      this.userSockets.set(userId, [...existingSockets, client.id]);
      this.logger.debug(
        `User ${userId} now has ${existingSockets.length + 1} active notification connections`,
      );

      // Join a room specific to this user
      client.join(`user_${userId}`);
      this.logger.debug(`Client ${client.id} joined room: user_${userId}`);

      // Associate userId with the socket for later reference
      client.data.userId = userId;
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const userId =
        client.data.userId || (client.handshake.query.userId as string);

      if (!userId) {
        this.logger.debug(`Client ${client.id} disconnected without user ID`);
        return;
      }

      this.logger.log(`Client disconnected: ${client.id} for user: ${userId}`);

      // Remove the socket from user's socket list
      const existingSockets = this.userSockets.get(userId) || [];
      const updatedSockets = existingSockets.filter(
        (socketId) => socketId !== client.id,
      );

      if (updatedSockets.length === 0) {
        this.logger.debug(
          `Removing user ${userId} from notification connections (no active connections)`,
        );
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, updatedSockets);
        this.logger.debug(
          `User ${userId} still has ${updatedSockets.length} active notification connections`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error in handleDisconnect: ${error.message}`,
        error.stack,
      );
    }
  }

  async emitNotification(userId: string, notification: CreateNotificationDto) {
    this.logger.log(
      `Emitting ${notification.type} notification to user: ${userId}`,
    );

    try {
      // Create and save the notification
      const savedNotification =
        await this.notificationService.createNotification(userId, notification);

      this.logger.debug(
        `Notification created with ID: ${savedNotification.id}, emitting to room user_${userId}`,
      );

      // Emit to specific user's room
      this.server.to(`user_${userId}`).emit('notification', savedNotification);

      // Get unread count to send along
      const { count } = await this.notificationService.getUnreadCount(userId);
      this.server.to(`user_${userId}`).emit('unreadCount', { count });

      this.logger.debug(
        `Notification sent to user ${userId} with unread count: ${count}`,
      );

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Error emitting notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @SubscribeMessage('readNotification')
  async handleReadNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() notificationId: string,
  ) {
    try {
      const userId =
        client.data.userId || (client.handshake.query.userId as string);

      if (!userId) {
        this.logger.warn(
          `Read notification attempt without userId, client: ${client.id}`,
        );
        return { success: false, message: 'User ID not provided' };
      }

      this.logger.log(
        `Marking notification ${notificationId} as read for user: ${userId}`,
      );

      // Mark the notification as read
      await this.notificationService.markAsRead(notificationId, userId);

      // Get updated unread count
      const { count } = await this.notificationService.getUnreadCount(userId);

      // Emit updated count to the user
      this.server.to(`user_${userId}`).emit('unreadCount', { count });

      this.logger.debug(
        `Notification ${notificationId} marked as read. Updated unread count: ${count}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error marking notification as read: ${error.message}`,
        error.stack,
      );
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('readAllNotifications')
  async handleReadAllNotifications(@ConnectedSocket() client: Socket) {
    try {
      const userId =
        client.data.userId || (client.handshake.query.userId as string);

      if (!userId) {
        this.logger.warn(
          `Mark all read attempt without userId, client: ${client.id}`,
        );
        return { success: false, message: 'User ID not provided' };
      }

      this.logger.log(`Marking all notifications as read for user: ${userId}`);

      // Mark all notifications as read
      const result = await this.notificationService.markAllAsRead(userId);

      // Emit updated count (which should be 0)
      this.server.to(`user_${userId}`).emit('unreadCount', { count: 0 });

      this.logger.debug(`All notifications marked as read for user: ${userId}`);

      // Return the result directly instead of adding a redundant success property
      return result;
    } catch (error) {
      this.logger.error(
        `Error marking all notifications as read: ${error.message}`,
        error.stack,
      );
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('getUnreadCount')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket) {
    try {
      const userId =
        client.data.userId || (client.handshake.query.userId as string);

      if (!userId) {
        this.logger.warn(
          `Get unread count attempt without userId, client: ${client.id}`,
        );
        return { success: false, message: 'User ID not provided' };
      }

      this.logger.debug(
        `Getting unread notification count for user: ${userId}`,
      );

      const result = await this.notificationService.getUnreadCount(userId);

      this.logger.debug(`Unread count for user ${userId}: ${result.count}`);

      // Return the result directly, adding success property only if needed
      return { ...result, success: true };
    } catch (error) {
      this.logger.error(
        `Error getting unread count: ${error.message}`,
        error.stack,
      );
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('deleteNotification')
  async handleDeleteNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() notificationId: string,
  ) {
    try {
      const userId =
        client.data.userId || (client.handshake.query.userId as string);

      if (!userId) {
        this.logger.warn(
          `Delete notification attempt without userId, client: ${client.id}`,
        );
        return { success: false, message: 'User ID not provided' };
      }

      this.logger.log(
        `Deleting notification ${notificationId} for user: ${userId}`,
      );

      const result = await this.notificationService.deleteNotification(
        notificationId,
        userId,
      );

      if (result.success) {
        // Get updated unread count
        const { count } = await this.notificationService.getUnreadCount(userId);
        this.server.to(`user_${userId}`).emit('unreadCount', { count });

        this.logger.debug(
          `Notification ${notificationId} deleted, unread count: ${count}`,
        );
      } else {
        this.logger.warn(`Failed to delete notification: ${result.message}`);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error deleting notification: ${error.message}`,
        error.stack,
      );
      return { success: false, message: error.message };
    }
  }

  @SubscribeMessage('deleteAllNotifications')
  async handleDeleteAllNotifications(@ConnectedSocket() client: Socket) {
    try {
      const userId =
        client.data.userId || (client.handshake.query.userId as string);

      if (!userId) {
        this.logger.warn(
          `Delete all notifications attempt without userId, client: ${client.id}`,
        );
        return { success: false, message: 'User ID not provided' };
      }

      this.logger.log(`Deleting all notifications for user: ${userId}`);

      const result =
        await this.notificationService.deleteAllNotifications(userId);

      // Emit updated count (which should be 0)
      this.server.to(`user_${userId}`).emit('unreadCount', { count: 0 });

      this.logger.debug(`All notifications deleted for user: ${userId}`);

      // Return the result directly
      return result;
    } catch (error) {
      this.logger.error(
        `Error deleting all notifications: ${error.message}`,
        error.stack,
      );
      return { success: false, message: error.message };
    }
  }
}
