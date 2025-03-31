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
import { Cache } from '../common/decorators/cache.decorator';

@Controller('projects')
@ApiTags('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}

  @Get()
  @Cache({ ttl: 120 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Returns all projects' })
  async getAllProjects() {
    return this.projectService.getAllProjects();
  }

  @Get(':id')
  @Cache({ ttl: 120, key: (request) => `project:${request.params.id}` })
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
}
