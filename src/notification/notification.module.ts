import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification-gateway';
import { LoggerService } from '../logger/logger.service';

@Module({
  providers: [NotificationGateway, NotificationService, LoggerService],
  controllers: [NotificationController],
  exports: [NotificationGateway],
})
export class NotificationModule {}
