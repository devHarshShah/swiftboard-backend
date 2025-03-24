import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/workflow.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(private prismaService: PrismaService) {}

  async createWorkflow(
    createWorkflowDto: CreateWorkflowDto,
    projectId: string,
  ) {
    try {
      const workflow = await this.prismaService.workFlow.create({
        data: {
          name: createWorkflowDto.name,
          project: {
            connect: { id: projectId },
          },
        },
      });

      const nodes = await this.prismaService.nodes.createMany({
        data: createWorkflowDto.nodes.map((node) => {
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

      const edges = await this.prismaService.edges.createMany({
        data: createWorkflowDto.edges.map((edge) => {
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

  async getWorkFlow(projectId: string) {
    const workflow = await this.prismaService.workFlow.findFirst({
      where: { projectId: projectId },
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

  async updateWorkflow(
    projectId: string,
    createWorkflowDto: CreateWorkflowDto,
  ) {
    try {
      // First find the workflow by projectId
      const existingWorkflow = await this.prismaService.workFlow.findFirst({
        where: { projectId: projectId },
      });

      if (!existingWorkflow) {
        throw new Error(`No workflow found for project with ID: ${projectId}`);
      }

      const workflow = await this.prismaService.workFlow.update({
        where: { id: existingWorkflow.id },
        data: {
          name: createWorkflowDto.name,
        },
      });

      await this.prismaService.nodes.deleteMany({
        where: { workFlowId: workflow.id },
      });

      await this.prismaService.edges.deleteMany({
        where: { workFlowId: workflow.id },
      });

      const nodes = await this.prismaService.nodes.createMany({
        data: createWorkflowDto.nodes.map((node) => {
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

  async publishWorkflow(
    projectId: string,
    createWorkflowDto: CreateWorkflowDto,
  ) {
    try {
      return await this.prismaService.$transaction(async (prisma) => {
        // Check if workflow already exists
        const existingWorkflow = await prisma.workFlow.findFirst({
          where: {
            name: createWorkflowDto.name,
          },
          include: {
            nodes: true,
            edges: true,
          },
        });

        let workflow;
        let nodes;
        let edges;

        if (!existingWorkflow) {
          // Create new workflow if it doesn't exist
          workflow = await prisma.workFlow.create({
            data: {
              name: createWorkflowDto.name,
              project: {
                connect: { id: projectId },
              },
            },
          });

          // Create nodes
          nodes = await prisma.nodes.createMany({
            data: createWorkflowDto.nodes.map((node) => ({
              id: node.id,
              type: node.type,
              positionX: node.positionX,
              positionY: node.positionY,
              data: {
                ...node.data,
                config: JSON.parse(node.data.config),
              },
              width: node.width,
              height: node.height,
              selected: node.selected,
              positionAbsoluteX: node.positionAbsoluteX,
              positionAbsoluteY: node.positionAbsoluteY,
              dragging: node.dragging,
              workFlowId: workflow.id,
            })),
          });

          // Create edges
          edges = await prisma.edges.createMany({
            data: createWorkflowDto.edges.map((edge) => ({
              id: edge.id,
              type: edge.type,
              source: edge.source,
              sourceHandle: edge.sourceHandle || null,
              target: edge.target,
              targetHandle: edge.targetHandle || null,
              animated: edge.animated,
              style: JSON.parse(edge.style),
              workFlowId: workflow.id,
            })),
          });
        } else {
          workflow = existingWorkflow;
          nodes = { count: existingWorkflow.nodes.length };
          edges = { count: existingWorkflow.edges.length };
        }

        // Get task nodes
        const taskNodes = createWorkflowDto.nodes.filter(
          (node) => node.data.type === 'task',
        );

        // Check for existing tasks to avoid recreation
        const existingTasks = await prisma.task.findMany({
          where: {
            projectId,
            name: { in: taskNodes.map((node) => node.data.label) },
          },
          include: {
            blockedBy: true,
            blocking: true,
          },
        });

        const existingTasksMap = new Map(
          existingTasks.map((task) => [task.name, task]),
        );

        // First pass: Create or update tasks without dependencies
        const taskMap = new Map<string, string>();
        const taskPromises = taskNodes.map(async (node) => {
          const config = JSON.parse(node.data.config);
          const existingTask = existingTasksMap.get(node.data.label);

          if (existingTask) {
            // Clear existing dependencies
            await prisma.task.update({
              where: { id: existingTask.id },
              data: {
                blockedBy: {
                  disconnect: existingTask.blockedBy.map((task) => ({
                    id: task.id,
                  })),
                },
                blocking: {
                  disconnect: existingTask.blocking.map((task) => ({
                    id: task.id,
                  })),
                },
              },
            });

            // Update existing task
            const updatedTask = await prisma.task.update({
              where: { id: existingTask.id },
              data: {
                description: node.data.description,
                taskAssignments: {
                  deleteMany: {},
                  create:
                    config.userIds?.map((userId: string) => ({
                      userId,
                      teamId: null,
                    })) || [],
                },
              },
            });
            taskMap.set(node.data.label, updatedTask.id);
            return updatedTask;
          } else {
            // Create new task
            const newTask = await prisma.task.create({
              data: {
                name: node.data.label,
                description: node.data.description,
                status: TaskStatus.TODO,
                projectId,
                taskAssignments: {
                  create:
                    config.userIds?.map((userId: string) => ({
                      userId,
                      teamId: null,
                    })) || [],
                },
              },
            });
            taskMap.set(node.data.label, newTask.id);
            return newTask;
          }
        });

        const tasks = await Promise.all(taskPromises);

        // Second pass: Set up dependencies
        for (const node of taskNodes) {
          const config = JSON.parse(node.data.config);
          const taskId = taskMap.get(node.data.label);

          if (taskId) {
            // Handle blockedBy relationships
            if (config.blockedBy?.length) {
              const blockedByIds = config.blockedBy
                .map((blockedTask: { id: string; name: string }) =>
                  taskMap.get(blockedTask.name),
                )
                .filter(Boolean);

              if (blockedByIds.length > 0) {
                await prisma.task.update({
                  where: { id: taskId },
                  data: {
                    blockedBy: {
                      connect: blockedByIds.map((id) => ({ id })),
                    },
                  },
                });
              }
            }

            // Handle blocking relationships
            if (config.blocking?.length) {
              const blockingIds = config.blocking
                .map((blockingTask: { id: string; name: string }) =>
                  taskMap.get(blockingTask.name),
                )
                .filter(Boolean);

              if (blockingIds.length > 0) {
                await prisma.task.update({
                  where: { id: taskId },
                  data: {
                    blocking: {
                      connect: blockingIds.map((id) => ({ id })),
                    },
                  },
                });
              }
            }
          }
        }
        return {
          workflow,
          nodesCount: nodes.count,
          edgesCount: edges.count,
          tasksCreated: tasks.filter((t) => !existingTasksMap.has(t.name))
            .length,
          tasksUpdated: tasks.filter((t) => existingTasksMap.has(t.name))
            .length,
        };
      });
    } catch (error) {
      console.error('Error publishing workflow:', error);
      throw error;
    }
  }
}
