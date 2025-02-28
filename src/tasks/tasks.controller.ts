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
import { CreateTaskDto, UpdateTaskDto, AssignTaskDto } from './dto/tasks.dto';
import { User } from 'src/common/decorators/user.decorator';

@Controller('projects/:projectId/tasks')
@ApiTags('tasks')
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tasks for a project' })
  async getAllTasksForProject(@Param('projectId') projectId: string) {
    return this.tasksService.getAllTasksForProject(projectId);
  }

  @Get(':taskId')
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
    return this.tasksService.assignTaskToUser(projectId, taskId, assignTaskDto);
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

  @Patch(':taskId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a task as complete' })
  async completeTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @User('id') userId: string, // Use the custom decorator to extract user ID
  ) {
    return this.tasksService.completeTask(projectId, taskId, userId);
  }
}
