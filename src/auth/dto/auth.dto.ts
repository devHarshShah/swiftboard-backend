import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'harsh@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'StrongPassword123',
    description: 'User password',
    minLength: 6,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;
}

export class SignupDto {
  @ApiProperty({
    example: 'harsh@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({
    example: 'Harsh Shah',
    description: 'Full name of the user',
    required: false,
  })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @ApiProperty({
    example: 'StrongPassword123',
    description: 'User password',
    minLength: 6,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @ApiProperty({
    example: 'StrongPassword123',
    description: 'Confirm password',
  })
  @IsString({ message: 'Confirm password must be a string' })
  @MinLength(6, { message: 'Confirm password must be at least 6 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/, {
    message: 'Passwords do not match',
  })
  confirmPassword!: string;
}
