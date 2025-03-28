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
        // First find the workflow by projectId
        const existingWorkflow = await prisma.workFlow.findFirst({
          where: { projectId: projectId },
        });

        if (!existingWorkflow) {
          throw new Error(
            `No workflow found for project with ID: ${projectId}`,
          );
        }

        const workflow = await prisma.workFlow.update({
          where: { id: existingWorkflow.id },
          data: {
            name: createWorkflowDto.name,
          },
        });

        // Create/update nodes and edges
        await prisma.nodes.deleteMany({
          where: { workFlowId: workflow.id },
        });

        await prisma.edges.deleteMany({
          where: { workFlowId: workflow.id },
        });

        const nodes = await prisma.nodes.createMany({
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

        const edges = await prisma.edges.createMany({
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

        // Get task nodes
        const taskNodes = createWorkflowDto.nodes.filter(
          (node) => node.data.type === 'task',
        );

        // Check for existing tasks to avoid recreation
        // We'll use a combination of name and node ID to make tasks unique
        const existingTasks = await prisma.task.findMany({
          where: {
            projectId,
          },
          include: {
            blockedBy: true,
            blocking: true,
            taskAssignments: true,
          },
        });

        // Create a mapping from task nodeId to task database ID
        // This will help us handle tasks with duplicate names
        const nodeIdToTaskMap = new Map();

        // We'll also keep a map from task name to task for backwards compatibility
        const existingTasksMap = new Map(
          existingTasks.map((task) => [task.name, task]),
        );

        // First pass: Create or update tasks without dependencies
        const taskPromises = taskNodes.map(async (node) => {
          const config = JSON.parse(node.data.config);

          // Store the node ID in the task metadata to identify it later
          const nodeId = node.id;
          const taskName = node.data.label;

          console.log(`Processing task node: ${nodeId} with name: ${taskName}`);
          console.log(`Config:`, config);

          // Check if this exact node has been processed before (using metadata)
          const existingTask = existingTasks.find((task) => {
            try {
              const metadata = task.metadata ? JSON.parse(task.metadata) : {};
              return metadata.nodeId === nodeId;
            } catch (e) {
              return false;
            }
          });

          // Debug user IDs
          if (config.userIds?.length > 0) {
            console.log(
              `User IDs for task ${taskName} (nodeId: ${nodeId}):`,
              config.userIds,
            );
          }

          if (existingTask) {
            console.log(
              `Updating existing task: ${existingTask.id} for node: ${nodeId}`,
            );

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

            // First delete existing task assignments
            await prisma.taskAssignment.deleteMany({
              where: { taskId: existingTask.id },
            });

            // Then update task with new assignments
            const updatedTask = await prisma.task.update({
              where: { id: existingTask.id },
              data: {
                name: taskName,
                description: node.data.description || existingTask.description,
                metadata: JSON.stringify({ nodeId }), // Store node ID in metadata
                taskAssignments: {
                  create:
                    config.userIds?.filter(Boolean).map((userId: string) => ({
                      userId,
                      teamId: null,
                    })) || [],
                },
              },
            });

            // Store both mappings
            nodeIdToTaskMap.set(nodeId, updatedTask.id);
            return updatedTask;
          } else {
            console.log(
              `Creating new task for node: ${nodeId} with name: ${taskName}`,
            );

            // Create new task
            const newTask = await prisma.task.create({
              data: {
                name: taskName,
                description: node.data.description || '',
                status: TaskStatus.TODO,
                metadata: JSON.stringify({ nodeId }), // Store node ID in metadata
                project: {
                  connect: { id: projectId },
                },
                taskAssignments: {
                  create:
                    config.userIds?.filter(Boolean).map((userId: string) => ({
                      userId,
                      teamId: null,
                    })) || [],
                },
              },
            });

            // Store both mappings
            nodeIdToTaskMap.set(nodeId, newTask.id);
            return newTask;
          }
        });

        const tasks = await Promise.all(taskPromises);

        // Debug the task map
        console.log('Node ID to Task ID map:');
        nodeIdToTaskMap.forEach((taskId, nodeId) => {
          console.log(`Node ${nodeId} -> Task ${taskId}`);
        });

        // Second pass: Set up dependencies based on node IDs, not task names
        for (const node of taskNodes) {
          const nodeId = node.id;
          const config = JSON.parse(node.data.config);
          const taskId = nodeIdToTaskMap.get(nodeId);

          if (!taskId) {
            console.log(`Warning: Task ID not found for node ${nodeId}`);
            continue;
          }

          // Handle blockedBy relationships
          if (config.blockedBy?.length) {
            const blockedByIds = config.blockedBy
              .map((blockedTask: { id: string; name: string }) => {
                const blockedNodeId = blockedTask.id;

                // Skip self-references
                if (blockedNodeId === nodeId) {
                  console.log(
                    `Skipping self-reference in blockedBy for node ${nodeId}`,
                  );
                  return null;
                }

                const blockedTaskId = nodeIdToTaskMap.get(blockedNodeId);
                if (!blockedTaskId) {
                  console.log(
                    `Warning: Couldn't find task ID for node ${blockedNodeId}`,
                  );
                  return null;
                }
                return blockedTaskId;
              })
              .filter(Boolean);

            if (blockedByIds.length > 0) {
              console.log(
                `Setting blockedBy for node ${nodeId}:`,
                blockedByIds,
              );

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
              .map((blockingTask: { id: string; name: string }) => {
                const blockingNodeId = blockingTask.id;

                // Skip self-references
                if (blockingNodeId === nodeId) {
                  console.log(
                    `Skipping self-reference in blocking for node ${nodeId}`,
                  );
                  return null;
                }

                const blockingTaskId = nodeIdToTaskMap.get(blockingNodeId);
                if (!blockingTaskId) {
                  console.log(
                    `Warning: Couldn't find task ID for node ${blockingNodeId}`,
                  );
                  return null;
                }
                return blockingTaskId;
              })
              .filter(Boolean);

            if (blockingIds.length > 0) {
              console.log(`Setting blocking for node ${nodeId}:`, blockingIds);

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

        // Verify all relationships were established properly
        const verifiedTasks = await prisma.task.findMany({
          where: {
            projectId,
            metadata: { not: null }, // Only get tasks that have metadata (created by workflow)
          },
          include: {
            blockedBy: {
              select: { id: true, name: true, metadata: true },
            },
            blocking: {
              select: { id: true, name: true, metadata: true },
            },
            taskAssignments: {
              include: {
                user: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        });

        console.log('Verification of created tasks:');
        verifiedTasks.forEach((task) => {
          let nodeId = 'unknown';
          try {
            nodeId = task.metadata
              ? JSON.parse(task.metadata).nodeId
              : 'unknown';
          } catch (e) {}

          console.log(`Task: ${task.name} (${task.id}) - Node: ${nodeId}`);
          console.log(
            `- BlockedBy: ${task.blockedBy.map((t) => t.name).join(', ') || 'none'}`,
          );
          console.log(
            `- Blocking: ${task.blocking.map((t) => t.name).join(', ') || 'none'}`,
          );
          console.log(
            `- Assigned users: ${task.taskAssignments.map((a) => a.user.name).join(', ') || 'none'}`,
          );
        });

        return {
          workflow,
          nodesCount:
            typeof nodes.count === 'number'
              ? nodes.count
              : createWorkflowDto.nodes.length,
          edgesCount:
            typeof edges.count === 'number'
              ? edges.count
              : createWorkflowDto.edges.length,
          tasksCreated: tasks.filter((t) => !t.id).length,
          tasksUpdated: tasks.filter((t) => t.id).length,
          tasks: verifiedTasks, // Return the verified tasks for debugging
        };
      });
    } catch (error) {
      console.error('Error publishing workflow:', error);
      throw error;
    }
  }
}
