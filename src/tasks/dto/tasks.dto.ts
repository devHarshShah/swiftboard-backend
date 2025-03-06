// tasks.dto.ts
import {
  IsString,
  IsOptional,
  IsArray,
  IsDate,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @ApiProperty({ description: 'Task name' })
  name?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Task description', required: false })
  description?: string;

  @IsArray()
  @IsOptional()
  @ApiProperty({
    description: 'User IDs to assign to this task',
    required: false,
    type: [String],
  })
  assignedUserIds?: string[];

  @IsArray()
  @IsOptional()
  @ApiProperty({
    description: 'Task IDs that block this task',
    required: false,
    type: [String],
  })
  blockedTaskIds?: string[];

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  @ApiProperty({ description: 'Due date for the task', required: false })
  dueDate?: Date;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ description: 'Estimated hours to complete', required: false })
  estimatedHours?: number;
}

export class UpdateTaskDto extends CreateTaskDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Task name', required: false })
  name?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  @ApiProperty({
    enum: TaskStatus,
    description: 'Task status',
    required: false,
  })
  status?: TaskStatus;
}

export class AssignTaskDto {
  @IsArray()
  @ApiProperty({
    description: 'User IDs to assign to this task',
    type: [String],
  })
  userIds: string[];
}

export class MoveTaskDto {
  @IsEnum(TaskStatus)
  @ApiProperty({
    enum: TaskStatus,
    description: 'New task status',
  })
  status: TaskStatus;
}

export class TimeTrackingDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Description of work done', required: false })
  description?: string;

  @IsDate()
  @Type(() => Date)
  @ApiProperty({ description: 'Start time of tracking session' })
  startTime: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  @ApiProperty({ description: 'End time of tracking session', required: false })
  endTime?: Date;
}
