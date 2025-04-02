import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { LoggerService } from '../logger/logger.service';
import { ConfigModule } from '@nestjs/config';
import { S3HealthIndicator } from './indicators/s3.health';
import { EmailerHealthIndicator } from './indicators/emailer.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { CustomMailerModule } from 'src/custommailer/custommailer.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    PrismaModule,
    RedisModule,
    ConfigModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    S3HealthIndicator,
    EmailerHealthIndicator,
    RedisHealthIndicator,
    LoggerService,
  ],
})
export class HealthModule {}
