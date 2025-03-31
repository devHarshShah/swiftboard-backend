import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { LoggerService } from '../logger/logger.service';
import { S3HealthIndicator } from '../common/health-indicators/s3.health';
import { RedisHealthIndicator } from 'src/common/health-indicators/redis.health';
import { EmailerHealthIndicator } from 'src/common/health-indicators/emailer.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private s3: S3HealthIndicator,
    private redis: RedisHealthIndicator,
    private emailer: EmailerHealthIndicator,
    private logger: LoggerService,
  ) {
    this.logger.setContext('HealthController');
  }

  @Get()
  @ApiOperation({ summary: 'Check general system health' })
  @HealthCheck()
  check() {
    this.logger.log('Performing health check');
    return this.health.check([
      () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.s3.isHealthy('s3_storage'),
      () => this.redis.isHealthy('redis_cache'),
      () => this.emailer.isHealthy('email_service'),
    ]);
  }

  @Get('detailed')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get detailed health information (authenticated users only)',
  })
  @HealthCheck()
  detailedCheck() {
    this.logger.log('Performing detailed health check');
    return this.health.check([
      () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.s3.isHealthy('s3_storage'),
      () => this.redis.isHealthy('redis_cache'),
      () => this.emailer.isHealthy('email_service'),
      // Add additional detailed checks here that are sensitive
    ]);
  }
}
