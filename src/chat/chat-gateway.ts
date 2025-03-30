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
import { ChatService } from './chat.service';
import { AddMessageDto } from './dto/chat.dto';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*', // Adjust for production
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, string[]>();
  private userRooms = new Map<string, Set<string>>();

  constructor(
    private chatService: ChatService,
    private redisService: RedisService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('ChatGateway');
  }

  afterInit(server: Server) {
    this.logger.log('Chat Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      if (!userId || userId === 'undefined') {
        this.logger.warn('Invalid userId during connection', {
          clientId: client.id,
        });
        client.disconnect(true);
        return;
      }

      this.logger.log(`Client connected: ${client.id} for user: ${userId}`);
      this.logger.debug(
        `Connection details: IP=${client.handshake.address}, transport=${client.conn.transport.name}`,
      );

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, []);
      }

      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.push(client.id);
        this.logger.debug(
          `User ${userId} now has ${userSockets.length} active connections`,
        );
      }

      client.data.userId = userId;

      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }

      this.server.emit('userOnline', { userId });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        this.logger.debug(`Client ${client.id} disconnected without user ID`);
        return;
      }

      this.logger.log(`Client disconnected: ${client.id} for user: ${userId}`);

      const userSockets = this.onlineUsers.get(userId) || [];
      const updatedSockets = userSockets.filter((id) => id !== client.id);

      if (updatedSockets.length === 0) {
        this.onlineUsers.delete(userId);
        this.logger.debug(
          `User ${userId} is now offline (no active connections)`,
        );

        const rooms = this.userRooms.get(userId) || new Set();
        this.logger.debug(`User ${userId} was in ${rooms.size} rooms`);

        for (const room of rooms) {
          this.server.to(room).emit('userOffline', { userId });
          this.logger.debug(`Broadcasting userOffline event to room: ${room}`);
        }

        this.server.emit('userOffline', { userId });
        this.userRooms.delete(userId);
      } else {
        this.onlineUsers.set(userId, updatedSockets);
        this.logger.debug(
          `User ${userId} still has ${updatedSockets.length} active connections`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error in handleDisconnect: ${error.message}`,
        error.stack,
      );
    }
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    try {
      const onlineUsersList = Array.from(this.onlineUsers.keys());

      this.logger.debug(
        `Sending online users list to client ${client.id}: ${onlineUsersList.length} users online`,
      );

      client.emit('onlineUsers', onlineUsersList);

      return {
        status: 'success',
        users: onlineUsersList,
      };
    } catch (error) {
      this.logger.error(
        `Error in getOnlineUsers: ${error.message}`,
        error.stack,
      );
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('userOnline')
  handleUserOnline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      if (client.data.userId !== data.userId) {
        this.logger.warn(
          `User ID mismatch: socket=${client.data.userId}, message=${data.userId}`,
        );
        return { status: 'error', message: 'User ID mismatch' };
      }

      this.logger.debug(`User ${data.userId} marked themselves as online`);

      if (!this.onlineUsers.has(data.userId)) {
        this.onlineUsers.set(data.userId, [client.id]);
      }

      this.server.emit('userOnline', { userId: data.userId });
      this.logger.debug(`Broadcasted userOnline event for ${data.userId}`);

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in userOnline: ${error.message}`, error.stack);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('userOffline')
  handleUserOffline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      if (client.data.userId !== data.userId) {
        this.logger.warn(
          `User ID mismatch: socket=${client.data.userId}, message=${data.userId}`,
        );
        return { status: 'error', message: 'User ID mismatch' };
      }

      this.logger.debug(`User ${data.userId} marked themselves as offline`);
      this.onlineUsers.delete(data.userId);

      this.server.emit('userOffline', { userId: data.userId });
      this.logger.debug(`Broadcasted userOffline event for ${data.userId}`);

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in userOffline: ${error.message}`, error.stack);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      const roomName = [data.userId, data.receiverId].sort().join('-');
      this.logger.log(`User ${data.userId} joining room ${roomName}`);

      client.data.userId = data.userId;

      const userRooms = this.userRooms.get(data.userId) || new Set();
      userRooms.add(roomName);
      this.userRooms.set(data.userId, userRooms);

      const receiverRooms = this.userRooms.get(data.receiverId) || new Set();
      receiverRooms.add(roomName);
      this.userRooms.set(data.receiverId, receiverRooms);

      client.join(roomName);
      this.logger.debug(`Socket ${client.id} joined room ${roomName}`);

      client.emit('joinRoomSuccess', {
        status: 'success',
        roomName,
        userId: data.userId,
      });

      if (this.onlineUsers.has(data.receiverId)) {
        this.logger.debug(
          `Notifying user ${data.userId} that receiver ${data.receiverId} is online`,
        );
        client.emit('userOnline', { userId: data.receiverId });
      } else {
        this.logger.debug(
          `Notifying user ${data.userId} that receiver ${data.receiverId} is offline`,
        );
        client.emit('userOffline', { userId: data.receiverId });
      }

      client.to(roomName).emit('userOnline', { userId: data.userId });

      return { status: 'success', roomName };
    } catch (error) {
      this.logger.error(`Error in joinRoom: ${error.message}`, error.stack);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AddMessageDto,
  ) {
    try {
      if (client.data.userId && client.data.userId !== payload.sender) {
        this.logger.warn(
          `Message sender ID does not match socket user ID. Socket: ${client.data.userId}, Payload: ${payload.sender}`,
        );
        return { status: 'error', message: 'Invalid sender ID' };
      }

      this.logger.log(
        `Processing new message from ${payload.sender} to ${payload.receiver}`,
      );

      // Save message
      const savedMessage = await this.chatService.addMessage(payload);
      this.logger.debug(`Message saved with ID: ${savedMessage.id}`);

      // Increment unread message count for receiver
      try {
        const unreadCount = await this.redisService.incrementUnreadCount(
          payload.receiver,
          payload.sender,
        );
        this.logger.debug(
          `Unread count for ${payload.receiver} from ${payload.sender} is now ${unreadCount}`,
        );

        const roomName = [payload.sender, payload.receiver].sort().join('-');

        // Emit message to room with unread count
        client.to(roomName).emit('newMessage', {
          ...savedMessage,
          unreadCount,
        });
        this.logger.debug(
          `Message broadcast to room ${roomName} with unread count`,
        );

        // Emit back to the sender
        client.emit('newMessage', {
          ...savedMessage,
          unreadCount,
        });
        this.logger.debug(`Message echo sent to sender ${payload.sender}`);
      } catch (redisError) {
        // Redis operation failed, but we still want to deliver the message
        this.logger.warn(
          `Redis error while incrementing unread count: ${redisError.message}`,
        );

        const roomName = [payload.sender, payload.receiver].sort().join('-');

        // Emit message without unread count
        this.server.to(roomName).emit('newMessage', savedMessage);
        this.logger.debug(
          `Message broadcast to room ${roomName} without unread count due to Redis error`,
        );
      }

      return { status: 'success', message: savedMessage };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      return { status: 'error', message: 'Failed to send message' };
    }
  }

  @SubscribeMessage('getUnreadCounts')
  async handleGetUnreadCounts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      // Verify user authentication
      if (client.data.userId !== data.userId) {
        this.logger.warn(
          `User ID mismatch in getUnreadCounts. Socket: ${client.data.userId}, Request: ${data.userId}`,
        );
        return { status: 'error', message: 'User ID mismatch' };
      }

      this.logger.debug(`Getting unread counts for user ${data.userId}`);

      // Get unread counts from Redis
      const unreadCounts = await this.redisService.getAllUnreadCounts(
        data.userId,
      );

      this.logger.debug(
        `Retrieved unread counts for ${Object.keys(unreadCounts).length} conversations`,
      );

      client.emit('unreadCounts', unreadCounts);

      return {
        status: 'success',
        unreadCounts,
      };
    } catch (error) {
      this.logger.error(
        `Error getting unread counts: ${error.message}`,
        error.stack,
      );
      return { status: 'error', message: 'Failed to retrieve unread counts' };
    }
  }

  @SubscribeMessage('markMessagesAsRead')
  async handleMarkMessagesAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; senderId: string },
  ) {
    try {
      // Verify user authentication
      if (client.data.userId !== data.userId) {
        this.logger.warn(
          `User ID mismatch in markMessagesAsRead. Socket: ${client.data.userId}, Request: ${data.userId}`,
        );
        return { status: 'error', message: 'User ID mismatch' };
      }

      this.logger.log(
        `Marking messages as read from ${data.senderId} to ${data.userId}`,
      );

      // Reset unread count for specific sender
      await this.redisService.resetUnreadCount(data.userId, data.senderId);
      this.logger.debug(
        `Reset unread count for ${data.userId} from ${data.senderId}`,
      );

      // Notify client that messages were marked as read
      client.emit('messagesMarkedAsRead', {
        senderId: data.senderId,
        unreadCount: 0,
      });
      this.logger.debug(`Notified client that messages were marked as read`);

      return { status: 'success' };
    } catch (error) {
      this.logger.error(
        `Error marking messages as read: ${error.message}`,
        error.stack,
      );
      return { status: 'error', message: 'Failed to mark messages as read' };
    }
  }

  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      const roomName = [data.userId, data.receiverId].sort().join('-');
      this.logger.debug(
        `User ${data.userId} started typing to ${data.receiverId} in room ${roomName}`,
      );

      client.to(roomName).emit('userTyping', { userId: data.userId });
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in startTyping: ${error.message}`, error.stack);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      const roomName = [data.userId, data.receiverId].sort().join('-');
      this.logger.debug(
        `User ${data.userId} stopped typing to ${data.receiverId} in room ${roomName}`,
      );

      client.to(roomName).emit('userStoppedTyping', { userId: data.userId });
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in stopTyping: ${error.message}`, error.stack);
      return { status: 'error', message: error.message };
    }
  }
}
