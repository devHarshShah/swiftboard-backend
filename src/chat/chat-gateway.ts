import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';
import { AddMessageDto } from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust this for production
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private chatService: ChatService) {}

  // Handle client connections
  handleConnection(client: Socket) {
    //console.log(`Client connected: ${client.id}`);
  }

  // Handle client disconnections
  handleDisconnect(client: Socket) {
    //console.log(`Client disconnected: ${client.id}`);
  }

  // Join room when a user opens a chat with another user
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; receiverId: string },
  ) {
    // Create a unique room name for this conversation (sorted to ensure consistency)
    const roomName = [data.userId, data.receiverId].sort().join('-');

    // Store user ID in socket data for later use
    client.data.userId = data.userId;

    client.join(roomName);
    //console.log(`User ${data.userId} joined room ${roomName}`);

    // Send confirmation back to client
    client.emit('joinRoomSuccess', {
      status: 'success',
      roomName,
      userId: data.userId,
    });

    return { status: 'success', roomName };
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
        console.warn('Message sender ID does not match socket user ID');
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
      console.error('Error sending message:', error);
      return { status: 'error', message: 'Failed to send message' };
    }
  }
}
