import {
  Controller,
  UseGuards,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { AuthGuard } from '@nestjs/passport';
import { LongCache, NoCache } from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';
import { GetUser } from '../users/decorators/user.decorator';

@Controller('projects')
@ApiTags('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectsService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @LongCache({
    ttl: 120,
    key: (request) => `projects:all:user:${request.user?.sub}`,
    tags: ['projects'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Returns all projects' })
  async getAllProjects() {
    return this.projectService.getAllProjects();
  }

  @Get(':id')
  @LongCache({
    ttl: 120,
    key: (request) => `project:${request.params.id}:user:${request.user?.sub}`,
    tags: ['project'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Returns the requested project' })
  async getProjectById(@Param('id') projectId: string) {
    return this.projectService.getProjectById(projectId);
  }

  @Post()
  @NoCache()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project successfully created' })
  async createProject(@Body() createProjectDto, @GetUser() userId: string) {
    const result = await this.projectService.createProject(createProjectDto);

    // Invalidate project list caches
    await this.invalidateProjectCaches();

    // If project is tied to a team, invalidate team caches
    if (createProjectDto.teamId) {
      await this.invalidateTeamCaches(createProjectDto.teamId);
    }

    return result;
  }

  @Put(':id')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update project details' })
  @ApiResponse({ status: 200, description: 'Returns the updated project' })
  async updateProject(
    @Param('id') projectId: string,
    @Body() updateProjectDto,
  ) {
    const result = await this.projectService.updateProject(
      projectId,
      updateProjectDto,
    );

    // Invalidate specific project cache and projects list
    await this.invalidateProjectCaches(projectId);

    // If project is tied to a team, invalidate team caches
    if (updateProjectDto.teamId) {
      await this.invalidateTeamCaches(updateProjectDto.teamId);
    }

    return result;
  }

  @Delete(':id')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiResponse({ status: 200, description: 'Project successfully deleted' })
  async deleteProject(@Param('id') projectId: string) {
    const project = await this.projectService.getProjectById(projectId);
    const result = await this.projectService.deleteProject(projectId);

    // Invalidate project caches
    await this.invalidateProjectCaches(projectId);

    // If project was tied to a team, invalidate team caches
    if (project?.teamId) {
      await this.invalidateTeamCaches(project.teamId);
    }

    // Invalidate related workflow and task caches
    await this.redisService.invalidateCachePattern(`*workflow:${projectId}*`);
    await this.redisService.invalidateCachePattern(
      `*project:${projectId}:tasks*`,
    );

    return result;
  }

  // Helper methods for cache invalidation
  private async invalidateProjectCaches(projectId?: string): Promise<void> {
    // Invalidate projects list cache
    await this.redisService.invalidateCachePattern(`*projects:all*`);

    // If project ID provided, invalidate that specific project
    if (projectId) {
      await this.redisService.invalidateCachePattern(`*project:${projectId}*`);
    }
  }

  private async invalidateTeamCaches(teamId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*team:${teamId}*`);
  }
}
