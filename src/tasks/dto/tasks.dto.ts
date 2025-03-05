import { IsOptional, IsString, IsArray, IsEnum } from 'class-validator';
import { TaskStatus } from '@prisma/client'; // Import the TaskStatus enum from the generated Prisma client

export class CreateTaskDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedUserIds?: string[];

  @IsOptional()
  @IsString()
  @IsArray()
  @IsString({ each: true })
  blockedTaskIds: string[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedTaskIds?: string[];
}

export class AssignTaskDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
