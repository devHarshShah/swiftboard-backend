import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { LoggerService } from '../logger/logger.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, LoggerService],
})
export class WorkflowModule {}
