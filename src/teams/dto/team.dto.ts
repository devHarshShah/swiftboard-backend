import { IsString, IsArray, ArrayNotEmpty, IsEmail } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];
}
