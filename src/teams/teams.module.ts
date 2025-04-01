import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { CustomMailerService } from 'src/custommailer/custommailer.service';
import { TeamInvitationsController } from './teams-invitation.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { LoggerService } from '../logger/logger.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [NotificationModule, RedisModule],
  providers: [TeamsService, CustomMailerService, LoggerService],
  controllers: [TeamsController, TeamInvitationsController],
})
export class TeamsModule {}
