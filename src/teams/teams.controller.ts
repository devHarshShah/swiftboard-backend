import {
  Controller,
  UseGuards,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../users/decorators/user.decorator';
import { CreateTeamDto } from './dto/team.dto';
import { LongCache, NoCache } from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('teams')
@ApiTags('teams')
@UseGuards(AuthGuard('jwt'))
export class TeamsController {
  constructor(
    private readonly teamService: TeamsService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @LongCache({
    ttl: 180,
    key: (request) => {
      const filterByRole = request.query.filterByRole;
      const userId = request.user?.sub;
      return filterByRole && userId
        ? `teams:filtered:${userId}`
        : 'teams:all:user:${userId}';
    },
    tags: ['teams'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all teams or teams where the user is an admin/editor',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all teams or filtered teams if userId is provided',
  })
  async getAllTeams(
    @Query('filterByRole') filterByRole?: boolean,
    @GetUser() userId?: string,
  ) {
    if (filterByRole && userId) {
      return this.teamService.getTeamsByUserRole(userId, ['Admin', 'Editor']);
    }
    return this.teamService.getAllTeams();
  }

  @Get(':id')
  @LongCache({
    ttl: 180,
    key: (request) => `team:${request.params.id}:user:${request.user?.sub}`,
    tags: ['team'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiResponse({ status: 200, description: 'Returns the requested team' })
  async getTeamById(@Param('id') teamId: string) {
    return this.teamService.getTeamById(teamId);
  }

  @Post()
  @NoCache()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team successfully created' })
  async createTeam(
    @GetUser() userId: string,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    const result = await this.teamService.createTeam(userId, createTeamDto);

    // Invalidate relevant caches
    await this.invalidateTeamListCaches();
    await this.invalidateUserTeamsCaches(userId);

    return result;
  }

  @Put(':id')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update team details' })
  @ApiResponse({ status: 200, description: 'Returns the updated team' })
  async updateTeam(@Param('id') teamId: string, @Body() updateTeamDto) {
    const result = await this.teamService.updateTeam(teamId, updateTeamDto);

    // Invalidate team cache
    await this.invalidateTeamCaches(teamId);

    return result;
  }

  @Delete(':id')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a team' })
  @ApiResponse({ status: 200, description: 'Team successfully deleted' })
  async deleteTeam(@Param('id') teamId: string) {
    // Get team members before deleting to invalidate their caches
    const members = await this.teamService.getTeamMembers(teamId);
    const result = await this.teamService.deleteTeam(teamId);

    // Invalidate team caches
    await this.invalidateTeamCaches(teamId);
    await this.invalidateTeamListCaches();

    // Invalidate cached user teams for all members
    for (const member of members) {
      await this.invalidateUserTeamsCaches(member.userId);
    }

    return result;
  }

  @Post(':id/members')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a member to the team' })
  @ApiResponse({ status: 200, description: 'Member added to the team' })
  async addMemberToTeam(@Param('id') teamId: string, @Body() addMemberDto) {
    const result = await this.teamService.addMemberToTeam(teamId, addMemberDto);

    // Invalidate team members cache
    await this.invalidateTeamMembersCaches(teamId);

    // Invalidate user's teams cache
    await this.invalidateUserTeamsCaches(addMemberDto.userId);

    return result;
  }

  @Delete(':id/members/:memberId')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the team' })
  @ApiResponse({ status: 200, description: 'Member removed from the team' })
  async removeMemberFromTeam(
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    const result = await this.teamService.removeMemberFromTeam(
      teamId,
      memberId,
    );

    // Invalidate team members cache
    await this.invalidateTeamMembersCaches(teamId);

    // Invalidate user's teams cache
    await this.invalidateUserTeamsCaches(memberId);

    return result;
  }

  @Get(':id/members')
  @LongCache({
    ttl: 300,
    key: (request) =>
      `team:${request.params.id}:members:user:${request.user?.sub}`,
    tags: ['team-members'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all team members' })
  @ApiResponse({ status: 200, description: 'Returns team members' })
  async getTeamMembers(@Param('id') teamId: string) {
    return this.teamService.getTeamMembers(teamId);
  }

  @Get(':id/projects')
  @LongCache({
    ttl: 180,
    key: (request) =>
      `team:${request.params.id}:projects:user:${request.user?.sub}`,
    tags: ['team-projects'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all projects under a team' })
  @ApiResponse({ status: 200, description: 'Returns all team projects' })
  async getTeamProjects(@Param('id') teamId: string) {
    return this.teamService.getTeamProjects(teamId);
  }

  @Get(':id/tasks')
  @LongCache({
    ttl: 60,
    key: (request) =>
      `team:${request.params.id}:tasks:user:${request.user?.sub}`,
    tags: ['team-tasks'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tasks under a team' })
  @ApiResponse({ status: 200, description: 'Returns all team tasks' })
  async getTeamTasks(@Param('id') teamId: string) {
    return this.teamService.getTeamTasks(teamId);
  }

  @Get('user/teams')
  @LongCache({
    ttl: 180,
    key: (request) => `user:${request.user.sub}:teams`,
    tags: ['user-teams'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all teams the user is part of' })
  @ApiResponse({
    status: 200,
    description: 'Returns all teams the user is part of',
  })
  async getUserTeams(@GetUser() userId: string) {
    return this.teamService.getUserTeams(userId);
  }

  // Helper methods for cache invalidation
  private async invalidateTeamCaches(teamId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*team:${teamId}*`);
  }

  private async invalidateTeamMembersCaches(teamId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*team:${teamId}:members*`);
  }

  private async invalidateTeamListCaches(): Promise<void> {
    await this.redisService.invalidateCachePattern(`*teams:all*`);
    await this.redisService.invalidateCachePattern(`*teams:filtered*`);
  }

  private async invalidateUserTeamsCaches(userId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*user:${userId}:teams*`);
  }
}
