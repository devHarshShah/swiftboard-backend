import { ApiProperty } from '@nestjs/swagger';
import { MessageStatus } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsArray,
} from 'class-validator';

export class AddMessageDto {
  @ApiProperty({
    description: 'The message content',
    example: 'Hello, how are you?',
  })
  @IsString()
  text?: string;

  @ApiProperty({
    description: 'ID of the user sending the message',
    example: 'user123',
  })
  @IsString()
  @IsNotEmpty()
  sender: string;

  @ApiProperty({
    description: 'ID of the user receiving the message',
    example: 'user456',
  })
  @IsString()
  @IsNotEmpty()
  receiver: string;

  @ApiProperty({
    description: 'Date when the message was sent',
    example: '2025-03-09',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Time when the message was sent',
    example: '14:30:00',
  })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiProperty({
    description: 'Status of the message',
    example: 'sent',
    enum: ['SENT', 'DELIVERED', 'READ'],
  })
  @IsEnum(MessageStatus)
  @IsNotEmpty()
  status: MessageStatus;

  @ApiProperty({
    description: 'List of attachments sent with the message',
    example: ['https://example.com/image.jpg'],
  })
  @IsString({ each: true })
  @IsArray()
  attachments?: string[];
}
