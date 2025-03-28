import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { CustomMailerService } from 'src/custommailer/custommailer.service';
import { TeamInvitationsController } from './teams-invitation.controller';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [TeamsService, CustomMailerService],
  controllers: [TeamsController, TeamInvitationsController],
})
export class TeamsModule {}
