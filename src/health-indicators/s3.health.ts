import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { S3 } from 'aws-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3HealthIndicator extends HealthIndicator {
  private s3: S3;

  constructor(private configService: ConfigService) {
    super();
    this.s3 = new S3({
      region: this.configService.get<string>('AWS_REGION'),
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const bucket = this.configService.get<string>('AWS_S3_BUCKET');
      if (!bucket) {
        throw new Error('AWS_S3_BUCKET is not defined');
      }
      // List objects to check if S3 is accessible
      await this.s3.listObjectsV2({ Bucket: bucket, MaxKeys: 1 }).promise();

      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'S3 health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}
