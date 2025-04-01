import {
  Controller,
  UseGuards,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AssignTaskDto,
  TimeTrackingDto,
  MoveTaskDto,
} from './dto/tasks.dto';
import { GetUser } from 'src/users/decorators/user.decorator';
import {
  ShortCache,
  LongCache,
  NoCache,
} from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('projects/:projectId/tasks')
@ApiTags('tasks')
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @ShortCache({
    ttl: 60,
    key: (request) =>
      `project:${request.params.projectId}:tasks:user:${request.user?.sub}`,
    tags: ['tasks', 'project-tasks'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tasks for a project' })
  async getAllTasksForProject(@Param('projectId') projectId: string) {
    return this.tasksService.getAllTasksForProject(projectId);
  }

  @Get(':taskId')
  @ShortCache({
    ttl: 60,
    key: (request) =>
      `project:${request.params.projectId}:task:${request.params.taskId}:user:${request.user?.sub}`,
    tags: ['task'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get task by ID for a project' })
  async getTaskByIdForProject(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.getTaskByIdForProject(projectId, taskId);
  }

  @Post()
  @NoCache()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task for a project' })
  async createTaskForProject(
    @Param('projectId') projectId: string,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    const result = await this.tasksService.createTaskForProject(
      projectId,
      createTaskDto,
    );

    // Invalidate tasks list cache for this project
    await this.invalidateProjectTasksCaches(projectId);

    return result;
  }

  @Put(':taskId')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task details for a project' })
  async updateTaskForProject(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    const result = await this.tasksService.updateTaskForProject(
      projectId,
      taskId,
      updateTaskDto,
    );

    // Invalidate task cache and tasks list
    await this.invalidateTaskCaches(projectId, taskId);
    await this.invalidateProjectTasksCaches(projectId);

    return result;
  }

  @Delete(':taskId')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task for a project' })
  async deleteTaskForProject(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    const result = await this.tasksService.deleteTaskForProject(
      projectId,
      taskId,
    );

    // Invalidate task cache and tasks list
    await this.invalidateTaskCaches(projectId, taskId);
    await this.invalidateProjectTasksCaches(projectId);

    // Also invalidate time stats caches
    await this.invalidateTaskTimeStatsCaches(projectId, taskId);
    await this.invalidateProjectTimeStatsCaches(projectId);

    return result;
  }

  @Post(':taskId/assign')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a task to a user' })
  async assignTaskToUser(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() assignTaskDto: AssignTaskDto,
  ) {
    const result = await this.tasksService.assignTaskToUsers(
      projectId,
      taskId,
      assignTaskDto,
    );

    // Invalidate task cache
    await this.invalidateTaskCaches(projectId, taskId);

    return result;
  }

  @Delete(':taskId/assign')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unassign a task from a user' })
  async unassignTaskFromUser(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    const result = await this.tasksService.unassignTaskFromUser(
      projectId,
      taskId,
    );

    // Invalidate task cache
    await this.invalidateTaskCaches(projectId, taskId);

    return result;
  }

  @Patch(':taskId/move')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move a task to a different status with automatic time tracking',
  })
  async moveTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser() userId: string,
    @Body() moveTaskDto: MoveTaskDto,
  ) {
    const result = await this.tasksService.moveTask(
      projectId,
      taskId,
      userId,
      moveTaskDto.status,
    );

    // Invalidate task cache and tasks list (since status has changed)
    await this.invalidateTaskCaches(projectId, taskId);
    await this.invalidateProjectTasksCaches(projectId);

    // Also invalidate time stats when task moves
    await this.invalidateTaskTimeStatsCaches(projectId, taskId);
    await this.invalidateProjectTimeStatsCaches(projectId);

    return result;
  }

  @Post(':taskId/time-tracking')
  @NoCache()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start time tracking for a task' })
  async startTimeTracking(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser() userId: string,
    @Body() timeTrackingDto: TimeTrackingDto,
  ) {
    const result = await this.tasksService.startTimeTracking(
      projectId,
      taskId,
      userId,
      timeTrackingDto,
    );

    // Invalidate time stats
    await this.invalidateTaskTimeStatsCaches(projectId, taskId);

    return result;
  }

  @Patch(':taskId/time-tracking/:sessionId')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop time tracking for a task' })
  async stopTimeTracking(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
    @GetUser() userId: string,
    @Body() timeTrackingDto: TimeTrackingDto,
  ) {
    const result = await this.tasksService.stopTimeTracking(
      projectId,
      taskId,
      userId,
      sessionId,
      timeTrackingDto,
    );

    // Invalidate task and project time stats
    await this.invalidateTaskTimeStatsCaches(projectId, taskId);
    await this.invalidateProjectTimeStatsCaches(projectId);

    return result;
  }

  @Get(':taskId/time-stats')
  @LongCache({
    ttl: 180,
    key: (request) =>
      `project:${request.params.projectId}:task:${request.params.taskId}:time-stats:user:${request.user?.sub}`,
    tags: ['task-time-stats'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get time statistics for a task' })
  async getTaskTimeStats(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.getTaskTimeStats(projectId, taskId);
  }

  @Get('time-stats')
  @LongCache({
    ttl: 180,
    key: (request) =>
      `project:${request.params.projectId}:time-stats:user:${request.user?.sub}`,
    tags: ['project-time-stats'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get time statistics for the entire project' })
  async getProjectTimeStats(@Param('projectId') projectId: string) {
    return this.tasksService.getProjectTimeStats(projectId);
  }

  // Helper methods for cache invalidation
  private async invalidateTaskCaches(
    projectId: string,
    taskId: string,
  ): Promise<void> {
    await this.redisService.invalidateCachePattern(
      `*project:${projectId}:task:${taskId}*`,
    );
  }

  private async invalidateProjectTasksCaches(projectId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(
      `*project:${projectId}:tasks*`,
    );
  }

  private async invalidateTaskTimeStatsCaches(
    projectId: string,
    taskId: string,
  ): Promise<void> {
    await this.redisService.invalidateCachePattern(
      `*project:${projectId}:task:${taskId}:time-stats*`,
    );
  }

  private async invalidateProjectTimeStatsCaches(
    projectId: string,
  ): Promise<void> {
    await this.redisService.invalidateCachePattern(
      `*project:${projectId}:time-stats*`,
    );
  }
}
