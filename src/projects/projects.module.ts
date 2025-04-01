import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { LoggerService } from '../logger/logger.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [NotificationModule, RedisModule],
  providers: [ProjectsService, LoggerService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
