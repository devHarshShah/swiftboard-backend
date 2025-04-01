import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { LoggerModule } from '../logger/logger.module';
import { S3HealthIndicator } from '../common/health-indicators/s3.health';
import { RedisHealthIndicator } from '../common/health-indicators/redis.health';
import { EmailerHealthIndicator } from '../common/health-indicators/emailer.health';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    LoggerModule,
    ConfigModule,
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [S3HealthIndicator, RedisHealthIndicator, EmailerHealthIndicator],
  exports: [S3HealthIndicator, RedisHealthIndicator, EmailerHealthIndicator],
})
export class HealthModule {}
