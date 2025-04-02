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
import { S3HealthIndicator } from './indicators/s3.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { EmailerHealthIndicator } from './indicators/emailer.health';
import { RedisService } from '../redis/redis.service';
import { NoCache } from '../common/decorators/cache.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { Public } from '../auth/decorators/public.decorator';

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
    private redisService: RedisService,
    private prisma: PrismaHealthIndicator,
  ) {
    this.logger.setContext('HealthController');
  }

  @Get()
  @NoCache() // Don't cache health checks
  @ApiOperation({ summary: 'Check general system health' })
  @HealthCheck()
  @Public()
  async check() {
    this.logger.log('Performing health check');

    // Clear health check caches to ensure fresh results
    try {
      await this.redisService.invalidateCache('health:system');
    } catch (error) {
      this.logger.warn(`Failed to clear health cache: ${error.message}`);
    }

    return this.health.check([
      () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.s3.isHealthy('s3_storage'),
      () => this.redis.isHealthy('redis_cache'),
      () => this.emailer.isHealthy('email_service'),
      () => this.prisma.isHealthy('database'),
    ]);
  }

  @Get('detailed')
  @NoCache() // Don't cache health checks
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get detailed health information (authenticated users only)',
  })
  @HealthCheck()
  async detailedCheck() {
    this.logger.log('Performing detailed health check');

    // Clear health check caches to ensure fresh results
    try {
      await this.redisService.invalidateCache('health:detailed');
    } catch (error) {
      this.logger.warn(
        `Failed to clear detailed health cache: ${error.message}`,
      );
    }

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
