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
import { Logger } from '@nestjs/common';

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

  private logger = new Logger('ChatGateway');

  private onlineUsers = new Map<string, string[]>();

  private userRooms = new Map<string, Set<string>>();

  constructor(private chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('Chat Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      if (!userId || userId === 'undefined') {
        this.logger.warn('Invalid userId during connection', {
          userId,
          clientId: client.id,
          query: client.handshake.query,
        });
        client.disconnect(true);
        return;
      }

      this.logger.log(`Client connected: ${client.id} for user: ${userId}`);

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, []);
      }

      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.push(client.id);
      }

      client.data.userId = userId;

      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }

      this.server.emit('userOnline', { userId });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        return;
      }

      this.logger.log(`Client disconnected: ${client.id} for user: ${userId}`);

      const userSockets = this.onlineUsers.get(userId) || [];
      const updatedSockets = userSockets.filter((id) => id !== client.id);

      if (updatedSockets.length === 0) {
        this.onlineUsers.delete(userId);

        const rooms = this.userRooms.get(userId) || new Set();
        for (const room of rooms) {
          this.server.to(room).emit('userOffline', { userId });
        }

        this.server.emit('userOffline', { userId });

        this.userRooms.delete(userId);
      } else {
        this.onlineUsers.set(userId, updatedSockets);
      }
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
    }
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    try {
      const onlineUsersList = Array.from(this.onlineUsers.keys());

      this.logger.log(
        `Sending online users list to ${client.id}: ${onlineUsersList.length} users`,
      );

      client.emit('onlineUsers', onlineUsersList);

      return {
        status: 'success',
        users: onlineUsersList,
      };
    } catch (error) {
      this.logger.error(`Error in getOnlineUsers: ${error.message}`);
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

      if (!this.onlineUsers.has(data.userId)) {
        this.onlineUsers.set(data.userId, [client.id]);
      }

      this.server.emit('userOnline', { userId: data.userId });

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in userOnline: ${error.message}`);
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

      this.onlineUsers.delete(data.userId);

      this.server.emit('userOffline', { userId: data.userId });

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in userOffline: ${error.message}`);
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

      client.data.userId = data.userId;

      const userRooms = this.userRooms.get(data.userId) || new Set();
      userRooms.add(roomName);
      this.userRooms.set(data.userId, userRooms);

      const receiverRooms = this.userRooms.get(data.receiverId) || new Set();
      receiverRooms.add(roomName);
      this.userRooms.set(data.receiverId, receiverRooms);

      client.join(roomName);

      this.logger.log(`User ${data.userId} joined room: ${roomName}`);

      client.emit('joinRoomSuccess', {
        status: 'success',
        roomName,
        userId: data.userId,
      });

      if (this.onlineUsers.has(data.receiverId)) {
        client.emit('userOnline', { userId: data.receiverId });
      } else {
        client.emit('userOffline', { userId: data.receiverId });
      }

      client.to(roomName).emit('userOnline', { userId: data.userId });

      return { status: 'success', roomName };
    } catch (error) {
      this.logger.error(`Error in joinRoom: ${error.message}`);
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
        this.logger.warn('Message sender ID does not match socket user ID');
        return { status: 'error', message: 'Invalid sender ID' };
      }

      const savedMessage = await this.chatService.addMessage(payload);

      const roomName = [payload.sender, payload.receiver].sort().join('-');

      this.server.to(roomName).emit('newMessage', savedMessage);

      return { status: 'success', message: savedMessage };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { status: 'error', message: 'Failed to send message' };
    }
  }

  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      const roomName = [data.userId, data.receiverId].sort().join('-');
      client.to(roomName).emit('userTyping', { userId: data.userId });
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in startTyping: ${error.message}`);
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
      client.to(roomName).emit('userStoppedTyping', { userId: data.userId });
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in stopTyping: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }
}
