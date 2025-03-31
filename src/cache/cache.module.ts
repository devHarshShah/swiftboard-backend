import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheInterceptor } from 'src/common/interceptors/cache.interceptor';
import { RedisModule } from 'src/redis/redis.module';
import { LoggerService } from 'src/logger/logger.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    LoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class CacheModule {}
