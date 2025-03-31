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
import { Cache } from '../common/decorators/cache.decorator';

@Controller('workflow')
@UseGuards(AuthGuard('jwt'))
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post(':projectId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow for a project' })
  async createTaskForProject(
    @Param('projectId') projectId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowService.createWorkflow(createWorkflowDto, projectId);
  }

  @Get(':projectId')
  @Cache({ ttl: 300, key: (request) => `workflow:${request.params.projectId}` })
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
  ) {
    return this.workflowService.updateWorkflow(projectId, createWorkflowDto);
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
  ) {
    return this.workflowService.publishWorkflow(projectId, createWorkflowDto);
  }
}
