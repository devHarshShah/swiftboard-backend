import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/workflow.dto';
import { TaskStatus } from '@prisma/client';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prismaService: PrismaService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('WorkflowService');
  }

  async createWorkflow(
    createWorkflowDto: CreateWorkflowDto,
    projectId: string,
  ) {
    this.logger.log(`Creating workflow for project: ${projectId}`);
    this.logger.debug(
      `Workflow creation request with ${createWorkflowDto.nodes.length} nodes and ${createWorkflowDto.edges.length} edges`,
    );

    try {
      const workflow = await this.prismaService.workFlow.create({
        data: {
          name: createWorkflowDto.name,
          project: {
            connect: { id: projectId },
          },
        },
      });
      this.logger.debug(`Created workflow: ${workflow.id} - ${workflow.name}`);

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
      this.logger.debug(
        `Created ${nodes.count} nodes for workflow ${workflow.id}`,
      );

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
      this.logger.debug(
        `Created ${edges.count} edges for workflow ${workflow.id}`,
      );

      this.logger.log(
        `Successfully created workflow ${workflow.id} for project ${projectId}`,
      );
      return {
        workflow,
        nodesCount: nodes.count,
        edgesCount: edges.count,
      };
    } catch (error) {
      this.logger.error(
        `Error creating workflow: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getWorkFlow(projectId: string) {
    this.logger.log(`Retrieving workflow for project: ${projectId}`);

    try {
      const workflow = await this.prismaService.workFlow.findFirst({
        where: { projectId: projectId },
        include: {
          nodes: true,
          edges: true,
        },
      });

      if (!workflow) {
        this.logger.warn(`No workflow found for project: ${projectId}`);
        return null;
      }

      this.logger.debug(
        `Found workflow ${workflow.id} with ${workflow.nodes.length} nodes and ${workflow.edges.length} edges`,
      );

      // Transform the data for frontend consumption
      const transformedData = {
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

      this.logger.debug(`Successfully transformed workflow data for frontend`);
      this.logger.log(
        `Retrieved workflow ${workflow.id} for project ${projectId}`,
      );
      return transformedData;
    } catch (error) {
      this.logger.error(
        `Error retrieving workflow for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateWorkflow(
    projectId: string,
    createWorkflowDto: CreateWorkflowDto,
  ) {
    this.logger.log(`Updating workflow for project: ${projectId}`);
    this.logger.debug(
      `Workflow update with ${createWorkflowDto.nodes.length} nodes and ${createWorkflowDto.edges.length} edges`,
    );

    try {
      // First find the workflow by projectId
      const existingWorkflow = await this.prismaService.workFlow.findFirst({
        where: { projectId: projectId },
      });

      if (!existingWorkflow) {
        this.logger.warn(`No workflow found for project with ID: ${projectId}`);
        throw new Error(`No workflow found for project with ID: ${projectId}`);
      }

      this.logger.debug(`Found existing workflow: ${existingWorkflow.id}`);

      const workflow = await this.prismaService.workFlow.update({
        where: { id: existingWorkflow.id },
        data: {
          name: createWorkflowDto.name,
        },
      });
      this.logger.debug(`Updated workflow name to: ${workflow.name}`);

      // Delete existing nodes
      const deletedNodes = await this.prismaService.nodes.deleteMany({
        where: { workFlowId: workflow.id },
      });
      this.logger.debug(`Deleted ${deletedNodes.count} existing nodes`);

      // Delete existing edges
      const deletedEdges = await this.prismaService.edges.deleteMany({
        where: { workFlowId: workflow.id },
      });
      this.logger.debug(`Deleted ${deletedEdges.count} existing edges`);

      // Create new nodes
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
      this.logger.debug(`Created ${nodes.count} new nodes`);

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
      this.logger.debug(`Created ${edges.count} new edges`);

      this.logger.log(
        `Successfully updated workflow ${workflow.id} for project ${projectId}`,
      );
      // Return the created workflow with counts of created nodes and edges
      return {
        workflow,
        nodesCount: nodes.count,
        edgesCount: edges.count,
      };
    } catch (error) {
      this.logger.error(
        `Error updating workflow for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishWorkflow(
    projectId: string,
    createWorkflowDto: CreateWorkflowDto,
  ) {
    this.logger.log(`Publishing workflow for project: ${projectId}`);
    this.logger.debug(
      `Publishing workflow with ${createWorkflowDto.nodes.length} nodes and ${createWorkflowDto.edges.length} edges`,
    );

    try {
      return await this.prismaService.$transaction(async (prisma) => {
        // First find the workflow by projectId
        const existingWorkflow = await prisma.workFlow.findFirst({
          where: { projectId: projectId },
        });

        if (!existingWorkflow) {
          this.logger.warn(
            `No workflow found for project with ID: ${projectId}`,
          );
          throw new Error(
            `No workflow found for project with ID: ${projectId}`,
          );
        }

        this.logger.debug(`Found existing workflow: ${existingWorkflow.id}`);

        const workflow = await prisma.workFlow.update({
          where: { id: existingWorkflow.id },
          data: {
            name: createWorkflowDto.name,
          },
        });
        this.logger.debug(`Updated workflow name to: ${workflow.name}`);

        // Create/update nodes and edges
        const deletedNodes = await prisma.nodes.deleteMany({
          where: { workFlowId: workflow.id },
        });
        this.logger.debug(`Deleted ${deletedNodes.count} existing nodes`);

        const deletedEdges = await prisma.edges.deleteMany({
          where: { workFlowId: workflow.id },
        });
        this.logger.debug(`Deleted ${deletedEdges.count} existing edges`);

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
        this.logger.debug(`Created ${nodes.count} new nodes`);

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
        this.logger.debug(`Created ${edges.count} new edges`);

        // Get task nodes
        const taskNodes = createWorkflowDto.nodes.filter(
          (node) => node.data.type === 'task',
        );
        this.logger.debug(`Found ${taskNodes.length} task nodes to process`);

        // Check for existing tasks to avoid recreation
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
        this.logger.debug(
          `Found ${existingTasks.length} existing tasks in project`,
        );

        // Create a mapping from task nodeId to task database ID
        const nodeIdToTaskMap = new Map();

        // We'll also keep a map from task name to task for backwards compatibility
        const existingTasksMap = new Map(
          existingTasks.map((task) => [task.name, task]),
        );

        // First pass: Create or update tasks without dependencies
        this.logger.debug(`Starting first pass: Creating or updating tasks`);
        const taskPromises = taskNodes.map(async (node) => {
          const config = JSON.parse(node.data.config);

          // Store the node ID in the task metadata to identify it later
          const nodeId = node.id;
          const taskName = node.data.label;

          this.logger.debug(
            `Processing task node: ${nodeId} with name: ${taskName}`,
          );

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
            this.logger.debug(
              `User IDs for task ${taskName} (nodeId: ${nodeId}): ${config.userIds.join(', ')}`,
            );
          }

          if (existingTask) {
            this.logger.debug(
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
            this.logger.debug(
              `Cleared existing dependencies for task: ${existingTask.id}`,
            );

            // First delete existing task assignments
            const deletedAssignments = await prisma.taskAssignment.deleteMany({
              where: { taskId: existingTask.id },
            });
            this.logger.debug(
              `Deleted ${deletedAssignments.count} existing task assignments`,
            );

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
            this.logger.debug(
              `Updated task: ${updatedTask.id} with ${config.userIds?.length || 0} assignments`,
            );

            // Store both mappings
            nodeIdToTaskMap.set(nodeId, updatedTask.id);
            return updatedTask;
          } else {
            this.logger.debug(
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
            this.logger.debug(
              `Created new task: ${newTask.id} with ${config.userIds?.length || 0} assignments`,
            );

            // Store both mappings
            nodeIdToTaskMap.set(nodeId, newTask.id);
            return newTask;
          }
        });

        const tasks = await Promise.all(taskPromises);
        this.logger.debug(
          `Completed first pass: ${tasks.length} tasks processed`,
        );

        // Debug the task map
        this.logger.debug('Node ID to Task ID map created');
        nodeIdToTaskMap.forEach((taskId, nodeId) => {
          this.logger.debug(`Node ${nodeId} -> Task ${taskId}`);
        });

        // Second pass: Set up dependencies based on node IDs, not task names
        this.logger.debug(`Starting second pass: Setting up task dependencies`);
        for (const node of taskNodes) {
          const nodeId = node.id;
          const config = JSON.parse(node.data.config);
          const taskId = nodeIdToTaskMap.get(nodeId);

          if (!taskId) {
            this.logger.warn(`Warning: Task ID not found for node ${nodeId}`);
            continue;
          }

          // Handle blockedBy relationships
          if (config.blockedBy?.length) {
            const blockedByIds = config.blockedBy
              .map((blockedTask: { id: string; name: string }) => {
                const blockedNodeId = blockedTask.id;

                // Skip self-references
                if (blockedNodeId === nodeId) {
                  this.logger.debug(
                    `Skipping self-reference in blockedBy for node ${nodeId}`,
                  );
                  return null;
                }

                const blockedTaskId = nodeIdToTaskMap.get(blockedNodeId);
                if (!blockedTaskId) {
                  this.logger.warn(
                    `Couldn't find task ID for node ${blockedNodeId}`,
                  );
                  return null;
                }
                return blockedTaskId;
              })
              .filter(Boolean);

            if (blockedByIds.length > 0) {
              this.logger.debug(
                `Setting ${blockedByIds.length} blockedBy dependencies for node ${nodeId}`,
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
                  this.logger.debug(
                    `Skipping self-reference in blocking for node ${nodeId}`,
                  );
                  return null;
                }

                const blockingTaskId = nodeIdToTaskMap.get(blockingNodeId);
                if (!blockingTaskId) {
                  this.logger.warn(
                    `Couldn't find task ID for node ${blockingNodeId}`,
                  );
                  return null;
                }
                return blockingTaskId;
              })
              .filter(Boolean);

            if (blockingIds.length > 0) {
              this.logger.debug(
                `Setting ${blockingIds.length} blocking dependencies for node ${nodeId}`,
              );

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
        this.logger.debug(
          `Completed second pass: Set up dependencies for tasks`,
        );

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
        this.logger.debug(
          `Verification: Retrieved ${verifiedTasks.length} tasks with relationships`,
        );

        this.logger.debug('Starting verification of task relationships');
        verifiedTasks.forEach((task) => {
          let nodeId = 'unknown';
          try {
            nodeId = task.metadata
              ? JSON.parse(task.metadata).nodeId
              : 'unknown';
          } catch (e) {}

          this.logger.debug(
            `Verified task: ${task.name} (${task.id}) - Node: ${nodeId}`,
          );
          this.logger.debug(
            `- BlockedBy: ${task.blockedBy.map((t) => t.name).join(', ') || 'none'}`,
          );
          this.logger.debug(
            `- Blocking: ${task.blocking.map((t) => t.name).join(', ') || 'none'}`,
          );
          this.logger.debug(
            `- Assigned users: ${task.taskAssignments.map((a) => a.user.name).join(', ') || 'none'}`,
          );
        });

        this.logger.log(
          `Successfully published workflow for project ${projectId}`,
        );
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
      this.logger.error(
        `Error publishing workflow for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
