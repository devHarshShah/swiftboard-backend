import { Injectable } from '@nestjs/common';
import { AddMessageDto } from './dto/chat.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prismaService: PrismaService) {}

  async addMessage(addMessageDto: AddMessageDto) {
    return this.prismaService.message.create({
      data: {
        text: addMessageDto.text,
        sender: {
          connect: { id: addMessageDto.sender },
        },
        receiver: {
          connect: { id: addMessageDto.receiver },
        },
      },
    });
  }

  async getMessagesBetweenUsers(userId1: string, userId2: string) {
    // Get messages where userId1 is sender and userId2 is receiver
    // OR userId2 is sender and userId1 is receiver
    // Order by sentAt (creation time) to maintain chronological order
    return this.prismaService.message.findMany({
      where: {
        OR: [
          {
            senderId: userId1,
            receiverId: userId2,
          },
          {
            senderId: userId2,
            receiverId: userId1,
          },
        ],
      },
      orderBy: {
        sentAt: 'asc', // or 'createdAt' if you prefer
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
