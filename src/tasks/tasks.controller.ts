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
import { TaskStatus } from '@prisma/client';
import { Cache } from '../common/decorators/cache.decorator';

@Controller('projects/:projectId/tasks')
@ApiTags('tasks')
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Cache({
    ttl: 60,
    key: (request) => `project:${request.params.projectId}:tasks`,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tasks for a project' })
  async getAllTasksForProject(@Param('projectId') projectId: string) {
    return this.tasksService.getAllTasksForProject(projectId);
  }

  @Get(':taskId')
  @Cache({
    ttl: 60,
    key: (request) =>
      `project:${request.params.projectId}:task:${request.params.taskId}`,
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task for a project' })
  async createTaskForProject(
    @Param('projectId') projectId: string,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.tasksService.createTaskForProject(projectId, createTaskDto);
  }

  @Put(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task details for a project' })
  async updateTaskForProject(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTaskForProject(
      projectId,
      taskId,
      updateTaskDto,
    );
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task for a project' })
  async deleteTaskForProject(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.deleteTaskForProject(projectId, taskId);
  }

  @Post(':taskId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a task to a user' })
  async assignTaskToUser(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() assignTaskDto: AssignTaskDto,
  ) {
    return this.tasksService.assignTaskToUsers(
      projectId,
      taskId,
      assignTaskDto,
    );
  }

  @Delete(':taskId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unassign a task from a user' })
  async unassignTaskFromUser(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.unassignTaskFromUser(projectId, taskId);
  }

  @Patch(':taskId/move')
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
    return this.tasksService.moveTask(
      projectId,
      taskId,
      userId,
      moveTaskDto.status,
    );
  }

  @Post(':taskId/time-tracking')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start time tracking for a task' })
  async startTimeTracking(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser() userId: string,
    @Body() timeTrackingDto: TimeTrackingDto,
  ) {
    return this.tasksService.startTimeTracking(
      projectId,
      taskId,
      userId,
      timeTrackingDto,
    );
  }

  @Patch(':taskId/time-tracking/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop time tracking for a task' })
  async stopTimeTracking(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('sessionId') sessionId: string,
    @GetUser() userId: string,
    @Body() timeTrackingDto: TimeTrackingDto,
  ) {
    return this.tasksService.stopTimeTracking(
      projectId,
      taskId,
      userId,
      sessionId,
      timeTrackingDto,
    );
  }

  @Get(':taskId/time-stats')
  @Cache({
    ttl: 180,
    key: (request) =>
      `project:${request.params.projectId}:task:${request.params.taskId}:time-stats`,
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
  @Cache({
    ttl: 180,
    key: (request) => `project:${request.params.projectId}:time-stats`,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get time statistics for the entire project' })
  async getProjectTimeStats(@Param('projectId') projectId: string) {
    return this.tasksService.getProjectTimeStats(projectId);
  }
}
