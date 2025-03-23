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

@Controller('workflow')
@UseGuards(AuthGuard('jwt'))
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow for a project' })
  async createTaskForProject(
    @Param('projectId') projectId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowService.createWorkflow(createWorkflowDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get specific workflow' })
  async getAllWorkflowsForProject(@Param('id') id: string) {
    return this.workflowService.getWorkFlow(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a workflow' })
  async updateWorkflow(
    @Param('id') id: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowService.updateWorkflow(id, createWorkflowDto);
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
