import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  HttpCode,
  HttpStatus,
  Body,
  UploadedFile,
  UseInterceptors,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AddMessageDto } from './dto/chat.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { GetUser } from 'src/users/decorators/user.decorator';
import {
  ShortCache,
  LongCache,
  NoCache,
} from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly redisService: RedisService,
  ) {}

  @Post()
  @NoCache()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new message' })
  @ApiResponse({ status: 201, description: 'Message successfully created' })
  async createMessage(@Body() addMessageDto: AddMessageDto) {
    const result = await this.chatService.addMessage(addMessageDto);

    // Invalidate chat messages cache
    await this.invalidateChatMessagesCaches(
      addMessageDto.sender,
      addMessageDto.receiver,
    );

    return result;
  }

  @Get('messages')
  @ShortCache({
    ttl: 30, // Short TTL for chat messages as they change frequently
    key: (request) => {
      const { userId1, userId2 } = request.query;
      const currentUser = request.user?.sub;
      // Make sure the current user is part of the conversation
      if (userId1 !== currentUser && userId2 !== currentUser) {
        // Return a unique, non-cacheable key instead of null
        return `chat:messages:unauthorized:${Date.now()}`;
      }
      return `chat:messages:${userId1}:${userId2}:user:${currentUser}`;
    },
    tags: ['chat-messages'],
  })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get messages between two users' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiQuery({ name: 'userId1', type: String, description: 'ID of first user' })
  @ApiQuery({ name: 'userId2', type: String, description: 'ID of second user' })
  async getMessagesBetweenUsers(
    @Query('userId1') userId1: string,
    @Query('userId2') userId2: string,
    @GetUser() currentUser: string,
  ) {
    // Security check - current user must be one of the conversation participants
    if (userId1 !== currentUser && userId2 !== currentUser) {
      throw new UnauthorizedException(
        'You can only access conversations you are part of',
      );
    }

    return this.chatService.getMessagesBetweenUsers(userId1, userId2);
  }

  @Post('upload')
  @NoCache()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file for a chat message' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        senderId: {
          type: 'string',
          description: 'ID of the message sender',
        },
        receiverId: {
          type: 'string',
          description: 'ID of the message recipient',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('senderId') senderId: string,
    @Body('receiverId') receiverId: string,
    @GetUser() currentUser: string,
  ) {
    // Verify that senderId matches authenticated user for security
    if (senderId !== currentUser) {
      throw new UnauthorizedException('SenderId must match authenticated user');
    }

    // First upload the file to S3
    const fileMetadata = await this.chatService.uploadFileToS3(file, senderId);

    // Then create a message with the attachment
    const messageData: AddMessageDto = {
      text: '', // Empty string for attachment-only message
      sender: senderId, // Use the senderId from form data
      receiver: receiverId, // Use receiverId from form data
      date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      time: new Date().toISOString().split('T')[1].substring(0, 8), // Current time in HH:MM:SS format
      status: 'SENT', // Default status for new messages
    };

    const result = await this.chatService.addMessageWithAttachment(
      messageData,
      fileMetadata,
    );

    // Invalidate chat messages cache
    await this.invalidateChatMessagesCaches(senderId, receiverId);

    return result;
  }

  @Get('attachments/:id')
  @LongCache({
    ttl: 3600, // Long TTL for attachments as they rarely change
    key: (request) =>
      `chat:attachment:${request.params.id}:user:${request.user?.sub}`,
    tags: ['chat-attachment'],
  })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a presigned URL for an attachment' })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
  })
  async getAttachmentUrl(@Param('id') attachmentId: string) {
    return this.chatService.generatePresignedUrl(attachmentId);
  }

  // Helper methods for cache invalidation
  private async invalidateChatMessagesCaches(
    userId1: string,
    userId2: string,
  ): Promise<void> {
    // Invalidate caches for conversation in both directions
    await this.redisService.invalidateCachePattern(
      `*chat:messages:${userId1}:${userId2}*`,
    );
    await this.redisService.invalidateCachePattern(
      `*chat:messages:${userId2}:${userId1}*`,
    );
  }
}
