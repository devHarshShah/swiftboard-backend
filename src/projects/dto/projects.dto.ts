import { IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  teamId: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;
}
