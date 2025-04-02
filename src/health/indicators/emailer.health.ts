import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../logger/logger.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailerHealthIndicator extends HealthIndicator {
  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    super();
    this.logger.setContext('EmailerHealthIndicator');
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // In production, we should do a real check
      // In development, use the nodemailer ethereal test account
      if (this.configService.get('NODE_ENV') === 'production') {
        // Create a transporter based on config
        const transporter = nodemailer.createTransport({
          host: this.configService.get<string>('EMAIL_HOST'),
          port: this.configService.get<number>('EMAIL_PORT'),
          secure: this.configService.get<boolean>('EMAIL_SECURE') === true,
          auth: {
            user: this.configService.get<string>('EMAIL_USERNAME'),
            pass: this.configService.get<string>('EMAIL_PASSWORD'),
          },
        });

        // Verify connection configuration
        await transporter.verify();
        this.logger.log('Email transporter verification successful');
      } else {
        // In development/test, we'll skip the actual verification
        this.logger.log('Email check skipped in non-production environment');
      }

      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error(
        `Email health check failed: ${error.message}`,
        error.stack,
      );
      throw new HealthCheckError(
        'Email health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}
