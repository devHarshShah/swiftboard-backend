import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailerHealthIndicator extends HealthIndicator {
  constructor(
    private configService: ConfigService,
    // Inject your email service here, for example:
    // private emailService: EmailService
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Implement a method to check if your email service is functioning
      // For example, checking connection to the SMTP server
      // Example: await this.emailService.checkConnection();

      // For demonstration, we're assuming it's healthy
      const isHealthy = true;

      return this.getStatus(key, isHealthy);
    } catch (error) {
      throw new HealthCheckError(
        'Email service health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}
