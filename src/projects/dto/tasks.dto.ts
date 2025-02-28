import { IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  name: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name: string;
}

export class AssignTaskDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}
