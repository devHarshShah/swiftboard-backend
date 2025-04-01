import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { GetUser } from 'src/users/decorators/user.decorator';
import { ShortCache, NoCache } from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('invitations')
@ApiTags('invitations')
export class TeamInvitationsController {
  constructor(
    private teamsService: TeamsService,
    private readonly redisService: RedisService,
  ) {}

  @Get('team/:teamId')
  @UseGuards(JwtAuthGuard)
  @ShortCache({
    ttl: 60, // Short TTL for invitations as they are time-sensitive
    key: (request) =>
      `team:${request.params.teamId}:invitations:user:${request.user?.sub}`,
    tags: ['team-invitations'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all invitations for a team' })
  @ApiResponse({
    status: 200,
    description: 'Returns all invitations for the team',
  })
  async getTeamInvitations(@Param('teamId') teamId: string) {
    return this.teamsService.getTeamInvitations(teamId);
  }

  @Get(':token')
  @ShortCache({
    ttl: 60,
    key: (request) => `invitation:${request.params.token}`,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get invitation by token' })
  @ApiResponse({ status: 200, description: 'Returns the invitation details' })
  async getInvitation(@Param('token') token: string) {
    return this.teamsService.getInvitationByToken(token);
  }

  @Post(':token/accept')
  @NoCache()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptInvitation(
    @GetUser() userId: string,
    @Param('token') token: string,
  ) {
    const result = await this.teamsService.processInvitation(token, userId);

    // Invalidate related caches
    await this.invalidateInvitationCaches(token);

    // Invalidate user's teams cache
    await this.redisService.invalidateCachePattern(`*user:${userId}:teams*`);

    // Get team ID from invitation to invalidate team caches
    const invitation = await this.teamsService.getInvitationByToken(token);
    if (invitation?.teamId) {
      await this.invalidateTeamCaches(invitation.teamId);
    }

    return result;
  }

  @Post(':token/decline')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation declined' })
  async declineInvitation(@Param('token') token: string) {
    const invitation = await this.teamsService.getInvitationByToken(token);
    const result = await this.teamsService.declineInvitation(token);

    // Invalidate invitation caches
    await this.invalidateInvitationCaches(token);

    // Invalidate team invitations cache
    if (invitation?.teamId) {
      await this.invalidateTeamInvitationsCaches(invitation.teamId);
    }

    return result;
  }

  @Post(':id/resend')
  @NoCache()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  async resendInvitation(@Param('id') id: string) {
    const result = await this.teamsService.resendInvitation(id);
    return result;
  }

  @Delete(':id/cancel')
  @NoCache()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled' })
  async cancelInvitation(@Param('id') id: string) {
    // Get invitation details before cancelling
    const invitation = await this.teamsService.getInvitationByToken(id);
    const result = await this.teamsService.cancelInvitation(id);

    // Invalidate team invitations cache
    if (invitation?.teamId) {
      await this.invalidateTeamInvitationsCaches(invitation.teamId);
    }

    return result;
  }

  @Post('send')
  @NoCache()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send invitations to a team' })
  @ApiResponse({ status: 200, description: 'Invitations sent' })
  async sendInvitations(@Body() data: { teamId: string; emails: string[] }) {
    const result = await this.teamsService.sendTeamInvitations(
      data.teamId,
      data.emails,
    );

    // Invalidate team invitations cache
    await this.invalidateTeamInvitationsCaches(data.teamId);

    return result;
  }

  // Helper methods for cache invalidation
  private async invalidateInvitationCaches(token: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*invitation:${token}*`);
  }

  private async invalidateTeamInvitationsCaches(teamId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(
      `*team:${teamId}:invitations*`,
    );
  }

  private async invalidateTeamCaches(teamId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*team:${teamId}*`);
  }
}
