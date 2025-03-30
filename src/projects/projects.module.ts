import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [NotificationModule],
  providers: [ProjectsService, LoggerService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
