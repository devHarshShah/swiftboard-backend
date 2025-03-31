import { Injectable, HttpStatus } from '@nestjs/common';
import { BaseService } from '../../common/services/base.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageStatus } from '@prisma/client';

@Injectable()
export class ChatService extends BaseService {
  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    super(logger);
  }

  // Direct messaging methods based on the schema
  async getDirectMessages(userId: string, otherUserId: string) {
    // Validate both users exist
    await this.validateUserExists(userId);
    await this.validateUserExists(otherUserId);

    return this.executeDbOperation(
      () =>
        this.prisma.message.findMany({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ],
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
            attachments: true,
          },
          orderBy: { sentAt: 'asc' },
        }),
      'Failed to retrieve direct messages',
      { userId, otherUserId },
    );
  }

  async sendDirectMessage(
    senderId: string,
    receiverId: string,
    text?: string,
    attachmentIds: string[] = [],
  ) {
    // Validate input
    this.validateBusinessRule(
      (!!text && text.trim().length > 0) || attachmentIds.length > 0,
      'Message must contain text or attachments',
      'INVALID_MESSAGE_CONTENT',
    );

    // Validate users exist
    await this.validateUserExists(senderId);
    await this.validateUserExists(receiverId);

    return this.executeDbOperation(
      async () => {
        const message = await this.prisma.message.create({
          data: {
            text,
            senderId,
            receiverId,
            status: MessageStatus.SENT,
            attachments: {
              connect: attachmentIds.map((id) => ({ id })),
            },
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
            attachments: true,
          },
        });

        return message;
      },
      'Failed to send direct message',
      { senderId, receiverId },
    );
  }

  async updateMessageStatus(messageId: string, status: MessageStatus) {
    return this.executeDbOperation(
      () =>
        this.prisma.message.update({
          where: { id: messageId },
          data: { status },
        }),
      'Failed to update message status',
      { messageId, status },
    );
  }

  private async validateUserExists(userId: string) {
    const user = await this.executeDbOperation(
      () =>
        this.prisma.user.findUnique({
          where: { id: userId },
        }),
      'Failed to validate user exists',
      { userId },
    );

    this.validateBusinessRule(
      user !== null,
      'User not found',
      'USER_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
  }
}
