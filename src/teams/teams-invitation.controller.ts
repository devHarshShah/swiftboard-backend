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

@Controller('invitations')
@ApiTags('invitations')
export class TeamInvitationsController {
  constructor(private teamsService: TeamsService) {}

  @Get('team/:teamId')
  @UseGuards(JwtAuthGuard)
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get invitation by token' })
  @ApiResponse({ status: 200, description: 'Returns the invitation details' })
  async getInvitation(@Param('token') token: string) {
    return this.teamsService.getInvitationByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptInvitation(
    @GetUser() userId: string,
    @Param('token') token: string,
  ) {
    return this.teamsService.processInvitation(token, userId);
  }

  @Post(':token/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation declined' })
  async declineInvitation(@Param('token') token: string) {
    return this.teamsService.declineInvitation(token);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  async resendInvitation(@Param('id') id: string) {
    return this.teamsService.resendInvitation(id);
  }

  @Delete(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled' })
  async cancelInvitation(@Param('id') id: string) {
    return this.teamsService.cancelInvitation(id);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send invitations to a team' })
  @ApiResponse({ status: 200, description: 'Invitations sent' })
  async sendInvitations(@Body() data: { teamId: string; emails: string[] }) {
    return this.teamsService.sendTeamInvitations(data.teamId, data.emails);
  }
}
