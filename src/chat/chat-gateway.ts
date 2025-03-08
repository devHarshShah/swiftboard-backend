import { OnModuleInit } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket) => {
      console.log('Connected');
      console.log(socket.id);
    });
  }

  @SubscribeMessage('message')
  onNewMessage(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    console.log(body);

    client.broadcast.emit('onMessage', {
      msg: 'New Message',
      content: body,
    });
  }
}
