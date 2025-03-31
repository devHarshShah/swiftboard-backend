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
import { Cache } from '../common/decorators/cache.decorator';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new message' })
  @ApiResponse({ status: 201, description: 'Message successfully created' })
  async createMessage(@Body() addMessageDto: AddMessageDto) {
    return this.chatService.addMessage(addMessageDto);
  }

  @Get('messages')
  @Cache({
    ttl: 30,
    key: (request) => {
      const { userId1, userId2 } = request.query;
      return `chat:messages:${userId1}:${userId2}`;
    },
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
  ) {
    return this.chatService.getMessagesBetweenUsers(userId1, userId2);
  }

  @Post('upload')
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
    console.log('senderId:', senderId);
    console.log('currentUser:', currentUser);
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

    return this.chatService.addMessageWithAttachment(messageData, fileMetadata);
  }

  @Get('attachments/:id')
  @Cache({ ttl: 3600, key: (request) => `attachment:${request.params.id}` })
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
}
