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
import { SubtasksService } from './subtasks.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateSubTaskDto, UpdateSubTaskDto } from './dto/subtask.dto';

@Controller('projects/:projectId/tasks/:taskId/subtasks')
@ApiTags('subtasks')
@UseGuards(AuthGuard('jwt'))
export class SubtasksController {
  constructor(private readonly subtaskService: SubtasksService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all subtasks for a task' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all subtasks',
  })
  async getAllSubtasksForTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.subtaskService.getAllSubtasksForTask(projectId, taskId);
  }

  @Get(':subtaskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get subtask by ID for a task' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved subtask' })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  async getSubtaskByIdForTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.subtaskService.getSubtaskByIdForTask(
      projectId,
      taskId,
      subtaskId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a subtask for a task' })
  @ApiResponse({ status: 201, description: 'Subtask successfully created' })
  async createSubtaskForTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() createSubtaskDto: CreateSubTaskDto,
  ) {
    return this.subtaskService.createSubtaskForTask(
      projectId,
      taskId,
      createSubtaskDto,
    );
  }

  @Put(':subtaskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update subtask details for a task' })
  @ApiResponse({ status: 200, description: 'Subtask successfully updated' })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  async updateSubtaskForTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
    @Body() updateSubtaskDto: UpdateSubTaskDto,
  ) {
    return this.subtaskService.updateSubtaskForTask(
      projectId,
      taskId,
      subtaskId,
      updateSubtaskDto,
    );
  }

  @Delete(':subtaskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a subtask for a task' })
  @ApiResponse({ status: 200, description: 'Subtask successfully deleted' })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  async deleteSubtaskForTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.subtaskService.deleteSubtaskForTask(
      projectId,
      taskId,
      subtaskId,
    );
  }

  @Patch(':subtaskId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a subtask as complete' })
  @ApiResponse({
    status: 200,
    description: 'Subtask successfully marked as complete',
  })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  async completeSubtask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.subtaskService.completeSubtask(projectId, taskId, subtaskId);
  }
}
