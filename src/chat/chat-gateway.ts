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
    origin: '*', // Adjust this for production
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ChatGateway');

  // Keep track of online users and their socket IDs
  private onlineUsers = new Map<string, string[]>();

  // Track user rooms for simpler notification
  private userRooms = new Map<string, Set<string>>();

  constructor(private chatService: ChatService) {}

  // Implement OnGatewayInit
  afterInit(server: Server) {
    this.logger.log('Chat Gateway initialized');
  }

  // Handle client connections
  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      if (!userId) {
        this.logger.warn('Client connected without userId');
        return;
      }

      this.logger.log(`Client connected: ${client.id} for user: ${userId}`);

      // Add user to online users map
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, []);
      }

      // Add this socket ID to the user's connections
      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.push(client.id);
      }

      // Store user ID in socket data for later use
      client.data.userId = userId;

      // Initialize user rooms if needed
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }

      // Only notify about online status after user joins rooms
      // We'll handle this in the joinRoom handler instead
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`);
    }
  }

  // Handle client disconnections
  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        return;
      }

      this.logger.log(`Client disconnected: ${client.id} for user: ${userId}`);

      // Remove this socket from the user's socket list
      const userSockets = this.onlineUsers.get(userId) || [];
      const updatedSockets = userSockets.filter((id) => id !== client.id);

      if (updatedSockets.length === 0) {
        // User is completely offline, remove from map
        this.onlineUsers.delete(userId);

        // Notify rooms that user is offline
        const rooms = this.userRooms.get(userId) || new Set();
        for (const room of rooms) {
          this.server.to(room).emit('userOffline', { userId });
        }

        // Clear user's rooms
        this.userRooms.delete(userId);
      } else {
        // User still has other active connections
        this.onlineUsers.set(userId, updatedSockets);
      }
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
    }
  }

  // Join room when a user opens a chat with another user
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      // Create a unique room name for this conversation (sorted to ensure consistency)
      const roomName = [data.userId, data.receiverId].sort().join('-');

      // Store user ID in socket data for later use (redundant but ensures it's set)
      client.data.userId = data.userId;

      // Add the room to user's rooms
      const userRooms = this.userRooms.get(data.userId) || new Set();
      userRooms.add(roomName);
      this.userRooms.set(data.userId, userRooms);

      // Also track for the receiver
      const receiverRooms = this.userRooms.get(data.receiverId) || new Set();
      receiverRooms.add(roomName);
      this.userRooms.set(data.receiverId, receiverRooms);

      // Join the socket to this room
      client.join(roomName);

      this.logger.log(`User ${data.userId} joined room: ${roomName}`);

      // Send confirmation back to client
      client.emit('joinRoomSuccess', {
        status: 'success',
        roomName,
        userId: data.userId,
      });

      // Let the user know if the receiver is online
      if (this.onlineUsers.has(data.receiverId)) {
        client.emit('userOnline', { userId: data.receiverId });
      } else {
        client.emit('userOffline', { userId: data.receiverId });
      }

      // Notify room that this user is online
      client.to(roomName).emit('userOnline', { userId: data.userId });

      return { status: 'success', roomName };
    } catch (error) {
      this.logger.error(`Error in joinRoom: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  // Handle sending messages
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AddMessageDto,
  ) {
    try {
      // Verify sender matches the socket's user ID to prevent spoofing
      if (client.data.userId && client.data.userId !== payload.sender) {
        this.logger.warn('Message sender ID does not match socket user ID');
        return { status: 'error', message: 'Invalid sender ID' };
      }

      // Save message to database
      const savedMessage = await this.chatService.addMessage(payload);

      // Create room name for this conversation
      const roomName = [payload.sender, payload.receiver].sort().join('-');

      // Broadcast message to everyone in the room
      this.server.to(roomName).emit('newMessage', savedMessage);

      return { status: 'success', message: savedMessage };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { status: 'error', message: 'Failed to send message' };
    }
  }

  // Handle typing status
  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      const roomName = [data.userId, data.receiverId].sort().join('-');
      // Broadcast to room that user is typing
      client.to(roomName).emit('userTyping', { userId: data.userId });
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in startTyping: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  // Handle stopped typing
  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    try {
      const roomName = [data.userId, data.receiverId].sort().join('-');
      // Broadcast to room that user stopped typing
      client.to(roomName).emit('userStoppedTyping', { userId: data.userId });
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error in stopTyping: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }
}
