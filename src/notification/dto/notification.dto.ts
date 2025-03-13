import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'The notification message',
    example: 'You have been assigned to a new task',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'The type of notification',
    example: 'TASK_ASSIGNMENT',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'The ID of the user to notify',
    example: 'user123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
