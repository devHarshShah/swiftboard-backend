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

@Controller('projects')
@ApiTags('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Returns all projects' })
  async getAllProjects() {
    return this.projectService.getAllProjects();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Returns the requested project' })
  async getProjectById(@Param('id') projectId: string) {
    return this.projectService.getProjectById(projectId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project successfully created' })
  async createProject(@Body() createProjectDto) {
    return this.projectService.createProject(createProjectDto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update project details' })
  @ApiResponse({ status: 200, description: 'Returns the updated project' })
  async updateProject(
    @Param('id') projectId: string,
    @Body() updateProjectDto,
  ) {
    return this.projectService.updateProject(projectId, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiResponse({ status: 200, description: 'Project successfully deleted' })
  async deleteProject(@Param('id') projectId: string) {
    return this.projectService.deleteProject(projectId);
  }

  @Get(':id/tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tasks for a project' })
  @ApiResponse({
    status: 200,
    description: 'Returns all tasks for the project',
  })
  async getAllTasksForProject(@Param('id') projectId: string) {
    return this.projectService.getAllTasksForProject(projectId);
  }

  @Get(':id/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get task by ID for a project' })
  @ApiResponse({
    status: 200,
    description: 'Returns the requested task for the project',
  })
  async getTaskByIdForProject(
    @Param('id') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectService.getTaskByIdForProject(projectId, taskId);
  }

  @Post(':id/tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task for a project' })
  @ApiResponse({ status: 201, description: 'Task successfully created' })
  async createTaskForProject(
    @Param('id') projectId: string,
    @Body() createTaskDto,
  ) {
    return this.projectService.createTaskForProject(projectId, createTaskDto);
  }

  @Put(':id/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task details for a project' })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated task for the project',
  })
  async updateTaskForProject(
    @Param('id') projectId: string,
    @Param('taskId') taskId: string,
    @Body() updateTaskDto,
  ) {
    return this.projectService.updateTaskForProject(
      projectId,
      taskId,
      updateTaskDto,
    );
  }

  @Delete(':id/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task for a project' })
  @ApiResponse({ status: 200, description: 'Task successfully deleted' })
  async deleteTaskForProject(
    @Param('id') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectService.deleteTaskForProject(projectId, taskId);
  }

  @Post(':id/tasks/:taskId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a task to a user' })
  @ApiResponse({ status: 200, description: 'Task assigned to the user' })
  async assignTaskToUser(
    @Param('id') projectId: string,
    @Param('taskId') taskId: string,
    @Body() assignTaskDto,
  ) {
    return this.projectService.assignTaskToUser(
      projectId,
      taskId,
      assignTaskDto,
    );
  }

  @Delete(':id/tasks/:taskId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unassign a task from a user' })
  @ApiResponse({ status: 200, description: 'Task unassigned from the user' })
  async unassignTaskFromUser(
    @Param('id') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectService.unassignTaskFromUser(projectId, taskId);
  }
}
