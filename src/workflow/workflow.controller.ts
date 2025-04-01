import {
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Body,
  UseGuards,
  Put,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkflowService } from './workflow.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateWorkflowDto } from './dto/workflow.dto';
import { LongCache } from '../common/decorators/cache.decorator';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { GetUser } from '../users/decorators/user.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('workflow')
@UseGuards(AuthGuard('jwt'))
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly cacheInvalidationService: CacheInvalidationService,
    private readonly redisService: RedisService, // Add RedisService here
  ) {}

  @Post(':projectId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow for a project' })
  async createTaskForProject(
    @Param('projectId') projectId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
    @GetUser() userId: string,
  ) {
    const result = await this.workflowService.createWorkflow(
      createWorkflowDto,
      projectId,
    );

    try {
      const workflowId = result.workflow.id;

      await this.cacheInvalidationService.invalidateOnWorkflowCreated(
        workflowId,
        userId,
      );
      await this.invalidateProjectCaches(projectId);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }

    return result;
  }

  @Get(':projectId')
  @LongCache({
    ttl: 300,
    key: (request) =>
      `workflow:${request.params.projectId}:user:${request.user?.sub}`,
    tags: ['workflow', 'project'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get specific workflow' })
  async getAllWorkflowsForProject(@Param('projectId') projectId: string) {
    return this.workflowService.getWorkFlow(projectId);
  }

  @Put(':projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a workflow' })
  async updateWorkflow(
    @Param('projectId') projectId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
    @GetUser() userId: string,
  ) {
    const result = await this.workflowService.updateWorkflow(
      projectId,
      createWorkflowDto,
    );

    // Invalidate workflow-related caches
    try {
      await this.cacheInvalidationService.invalidateOnWorkflowUpdated(
        projectId,
        userId,
      );
      await this.invalidateProjectCaches(projectId);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      // Don't fail the request if cache invalidation fails
    }

    return result;
  }

  @Post(':projectId/publish')
  @ApiOperation({ summary: 'Publish workflow and create associated tasks' })
  @ApiResponse({
    status: 201,
    description: 'Workflow published and tasks created successfully',
  })
  async publishWorkflow(
    @Param('projectId') projectId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
    @GetUser() userId: string,
  ) {
    const result = await this.workflowService.publishWorkflow(
      projectId,
      createWorkflowDto,
    );

    // Invalidate workflow and task caches
    try {
      await this.cacheInvalidationService.invalidateOnWorkflowUpdated(
        projectId,
        userId,
      );
      await this.invalidateProjectCaches(projectId);
      await this.invalidateTasksCaches(projectId);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      // Don't fail the request if cache invalidation fails
    }

    return result;
  }

  // Helper methods for cache invalidation
  private async invalidateProjectCaches(projectId: string): Promise<void> {
    try {
      await this.redisService.safeInvalidateCachePattern(
        `*project:${projectId}*`,
      );
      await this.redisService.safeInvalidateCachePattern(
        `*workflow:${projectId}*`,
      );
    } catch (error) {
      console.error('Error in invalidateProjectCaches:', error);
    }
  }

  private async invalidateTasksCaches(projectId: string): Promise<void> {
    try {
      await this.redisService.safeInvalidateCachePattern(
        `*project:${projectId}:tasks*`,
      );
    } catch (error) {
      console.error('Error in invalidateTasksCaches:', error);
    }
  }
}
