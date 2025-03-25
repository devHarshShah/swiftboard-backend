import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { Redis } from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
        });
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
