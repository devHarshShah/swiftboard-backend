import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private prismaService: PrismaService) {}

  async createWorkflow(createWorkflowDto: CreateWorkflowDto) {
    try {
      // Create the workflow first
      const workflow = await this.prismaService.workFlow.create({
        data: {
          name: createWorkflowDto.name,
        },
      });

      // Create all nodes associated with this workflow
      const nodes = await this.prismaService.nodes.createMany({
        data: createWorkflowDto.nodes.map((node) => {
          // Parse the config string back to an object
          const dataWithParsedConfig = {
            ...node.data,
            config: JSON.parse(node.data.config),
          };

          return {
            id: node.id,
            type: node.type,
            positionX: node.positionX,
            positionY: node.positionY,
            data: dataWithParsedConfig,
            width: node.width,
            height: node.height,
            selected: node.selected,
            positionAbsoluteX: node.positionAbsoluteX,
            positionAbsoluteY: node.positionAbsoluteY,
            dragging: node.dragging,
            workFlowId: workflow.id,
          };
        }),
      });

      // Create all edges associated with this workflow
      const edges = await this.prismaService.edges.createMany({
        data: createWorkflowDto.edges.map((edge) => {
          // Parse the style string back to an object
          const styleData = JSON.parse(edge.style);

          return {
            id: edge.id,
            type: edge.type,
            source: edge.source,
            sourceHandle: edge.sourceHandle || null,
            target: edge.target,
            targetHandle: edge.targetHandle || null,
            animated: edge.animated,
            style: styleData,
            workFlowId: workflow.id,
          };
        }),
      });

      // Return the created workflow with counts of created nodes and edges
      return {
        workflow,
        nodesCount: nodes.count,
        edgesCount: edges.count,
      };
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async getWorkFlow(id: string) {
    const workflow = await this.prismaService.workFlow.findUnique({
      where: { id },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow) {
      return null;
    }

    // Transform the data for frontend consumption
    return {
      id: workflow.id,
      name: workflow.name,
      nodes: workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: {
          x: node.positionX,
          y: node.positionY,
        },
        data: node.data,
        width: node.width,
        height: node.height,
        selected: node.selected,
        positionAbsolute: {
          x: node.positionAbsoluteX,
          y: node.positionAbsoluteY,
        },
        dragging: node.dragging,
      })),
      edges: workflow.edges.map((edge) => ({
        id: edge.id,
        type: edge.type,
        style: edge.style,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
        animated: edge.animated,
      })),
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  }

  async updateWorkflow(id: string, createWorkflowDto: CreateWorkflowDto) {
    try {
      // Update the workflow
      const workflow = await this.prismaService.workFlow.update({
        where: { id },
        data: {
          name: createWorkflowDto.name,
        },
      });

      // Delete all nodes and edges associated with this workflow
      await this.prismaService.nodes.deleteMany({
        where: { workFlowId: id },
      });

      await this.prismaService.edges.deleteMany({
        where: { workFlowId: id },
      });

      // Create all nodes associated with this workflow
      const nodes = await this.prismaService.nodes.createMany({
        data: createWorkflowDto.nodes.map((node) => {
          // Parse the config string back to an object
          const dataWithParsedConfig = {
            ...node.data,
            config: JSON.parse(node.data.config),
          };

          return {
            id: node.id,
            type: node.type,
            positionX: node.positionX,
            positionY: node.positionY,
            data: dataWithParsedConfig,
            width: node.width,
            height: node.height,
            selected: node.selected,
            positionAbsoluteX: node.positionAbsoluteX,
            positionAbsoluteY: node.positionAbsoluteY,
            dragging: node.dragging,
            workFlowId: workflow.id,
          };
        }),
      });

      // Create all edges associated with this workflow
      const edges = await this.prismaService.edges.createMany({
        data: createWorkflowDto.edges.map((edge) => {
          // Parse the style string back to an object
          const styleData = JSON.parse(edge.style);

          return {
            id: edge.id,
            type: edge.type,
            source: edge.source,
            sourceHandle: edge.sourceHandle || null,
            target: edge.target,
            targetHandle: edge.targetHandle || null,
            animated: edge.animated,
            style: styleData,
            workFlowId: workflow.id,
          };
        }),
      });

      // Return the created workflow with counts of created nodes and edges
      return {
        workflow,
        nodesCount: nodes.count,
        edgesCount: edges.count,
      };
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw error;
    }
  }
}
