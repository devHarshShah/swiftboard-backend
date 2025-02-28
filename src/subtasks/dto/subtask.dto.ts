import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubTaskDto {
  @ApiProperty({ description: 'Name of the subtask' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'ID of the parent task' })
  @IsString()
  @IsNotEmpty()
  taskId: string;
}

export class UpdateSubTaskDto {
  @ApiProperty({ description: 'Name of the subtask', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Completion status of the subtask',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
