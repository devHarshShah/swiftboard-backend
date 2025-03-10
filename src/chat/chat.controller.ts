import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AddMessageDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new message' })
  @ApiResponse({ status: 201, description: 'Message successfully created' })
  async createMessage(@Body() addMessageDto: AddMessageDto) {
    return this.chatService.addMessage(addMessageDto);
  }

  @Get('messages')
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
}
