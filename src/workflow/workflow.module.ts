import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { LoggerService } from '../logger/logger.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, LoggerService],
})
export class WorkflowModule {}
