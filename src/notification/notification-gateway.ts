import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/notification.dto';

@WebSocketGateway({
  namespace: 'notification',
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(private notificationService: NotificationService) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.disconnect();
      return;
    }

    // Store the socket-user association
    const existingSockets = this.userSockets.get(userId) || [];
    this.userSockets.set(userId, [...existingSockets, client.id]);

    // Join a room specific to this user
    client.join(`user_${userId}`);
    console.log(`Client connected: ${client.id} for user: ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId) {
      // Remove the socket from user's socket list
      const existingSockets = this.userSockets.get(userId) || [];
      this.userSockets.set(
        userId,
        existingSockets.filter((socketId) => socketId !== client.id),
      );

      // If no more sockets for this user, remove the user entry
      if (this.userSockets.get(userId)?.length === 0) {
        this.userSockets.delete(userId);
      }
    }

    console.log(`Client disconnected: ${client.id}`);
  }

  async emitNotification(userId: string, notification: CreateNotificationDto) {
    const savedNotification = await this.notificationService.createNotification(
      userId,
      notification,
    );

    // Emit to specific user's room
    this.server.to(`user_${userId}`).emit('notification', savedNotification);
    return savedNotification;
  }

  @SubscribeMessage('readNotification')
  async handleReadNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() notificationId: string,
  ) {
    const userId = client.handshake.query.userId as string;
    if (!userId) return;

    await this.notificationService.markAsRead(notificationId, userId);
  }
}
