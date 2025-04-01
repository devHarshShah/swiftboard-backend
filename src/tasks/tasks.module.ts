import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { LoggerService } from '../logger/logger.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [PrismaModule, NotificationModule, RedisModule],
  controllers: [TasksController],
  providers: [TasksService, LoggerService],
})
export class TasksModule {}
