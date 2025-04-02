import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class S3HealthIndicator extends HealthIndicator {
  private s3Client: S3Client;
  private readonly isProduction: boolean;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    super();
    this.logger.setContext('S3HealthIndicator');
    this.isProduction = this.configService.get('NODE_ENV') === 'production';

    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    // Initialize S3 client with proper type handling
    this.s3Client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // In production, do a real check
      // In development, we can be more lenient if credentials aren't set up
      if (this.isProduction) {
        // Simple check to verify AWS credentials and connectivity
        await this.s3Client.send(new ListBucketsCommand({}));
        this.logger.log('S3 connectivity check successful');
      } else {
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );

        if (!accessKeyId || !secretAccessKey) {
          this.logger.warn(
            'S3 credentials not fully configured in development mode - skipping connection test',
          );
        } else {
          await this.s3Client.send(new ListBucketsCommand({}));
          this.logger.log('S3 connectivity check successful');
        }
      }

      return this.getStatus(key, true);
    } catch (error) {
      // Only throw a health check error in production
      if (this.isProduction) {
        this.logger.error(
          `S3 health check failed: ${error.message}`,
          error.stack,
        );
        throw new HealthCheckError(
          'S3 health check failed',
          this.getStatus(key, false, { error: error.message }),
        );
      } else {
        // In development, log the error but don't fail the health check
        this.logger.warn(
          `S3 health check warning (dev mode): ${error.message}`,
        );
        return this.getStatus(key, true, {
          warning: 'S3 connection failed in development mode',
          error: error.message,
        });
      }
    }
  }
}
