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

@Controller('teams')
@ApiTags('teams')
@UseGuards(AuthGuard('jwt'))
export class TeamsController {
  constructor(private readonly teamService: TeamsService) {}

  @Get()
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiResponse({ status: 200, description: 'Returns the requested team' })
  async getTeamById(@Param('id') teamId: string) {
    return this.teamService.getTeamById(teamId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team successfully created' })
  async createTeam(
    @GetUser() userId: string,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    return this.teamService.createTeam(userId, createTeamDto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update team details' })
  @ApiResponse({ status: 200, description: 'Returns the updated team' })
  async updateTeam(@Param('id') teamId: string, @Body() updateTeamDto) {
    return this.teamService.updateTeam(teamId, updateTeamDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a team' })
  @ApiResponse({ status: 200, description: 'Team successfully deleted' })
  async deleteTeam(@Param('id') teamId: string) {
    return this.teamService.deleteTeam(teamId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a member to the team' })
  @ApiResponse({ status: 200, description: 'Member added to the team' })
  async addMemberToTeam(@Param('id') teamId: string, @Body() addMemberDto) {
    return this.teamService.addMemberToTeam(teamId, addMemberDto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the team' })
  @ApiResponse({ status: 200, description: 'Member removed from the team' })
  async removeMemberFromTeam(
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamService.removeMemberFromTeam(teamId, memberId);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all team members' })
  @ApiResponse({ status: 200, description: 'Returns team members' })
  async getTeamMembers(@Param('id') teamId: string) {
    return this.teamService.getTeamMembers(teamId);
  }

  @Get(':id/projects')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all projects under a team' })
  @ApiResponse({ status: 200, description: 'Returns all team projects' })
  async getTeamProjects(@Param('id') teamId: string) {
    return this.teamService.getTeamProjects(teamId);
  }

  @Get(':id/tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tasks under a team' })
  @ApiResponse({ status: 200, description: 'Returns all team tasks' })
  async getTeamTasks(@Param('id') teamId: string) {
    return this.teamService.getTeamTasks(teamId);
  }

  @Get('user/teams')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all teams the user is part of' })
  @ApiResponse({
    status: 200,
    description: 'Returns all teams the user is part of',
  })
  async getUserTeams(@GetUser() userId: string) {
    return this.teamService.getUserTeams(userId);
  }
}
