import { plainToClass, Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsBoolean,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRY: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRY: string;

  @IsOptional()
  @IsString()
  JWT_AUDIENCE: string;

  @IsOptional()
  @IsString()
  JWT_ISSUER: string;

  @IsOptional()
  @IsString()
  ALLOWED_ORIGINS: string;

  @IsNumber()
  @IsOptional()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  // Google OAuth
  @IsString()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  GOOGLE_CALLBACK_URL: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  FRONTEND_URL: string;

  // Email configuration
  @IsString()
  EMAIL_HOST: string;

  @IsNumber()
  @Type(() => Number)
  EMAIL_PORT: number;

  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  EMAIL_SECURE: boolean;

  @IsString()
  EMAIL_USERNAME: string;

  @IsString()
  EMAIL_PASSWORD: string;

  // Redis
  @IsOptional()
  @IsString()
  REDIS_HOST: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD: string;

  // AWS S3
  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  S3_BUCKET_NAME: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    console.error('Environment validation errors:');
    errors.forEach((error) => {
      const constraints = error.constraints || {};
      const messages = Object.values(constraints);
      console.error(`- ${error.property}: ${messages.join(', ')}`);
    });
    throw new Error('Invalid environment configuration');
  }
  return validatedConfig;
}
