import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AssignTaskDto,
  TimeTrackingDto,
} from './dto/tasks.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { NotificationGateway } from 'src/notification/notification-gateway';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class TasksService {
  constructor(
    private prismaService: PrismaService,
    private notificationGateway: NotificationGateway,
    private logger: LoggerService,
  ) {
    this.logger.setContext('TasksService');
  }

  async getAllTasksForProject(projectId: string) {
    this.logger.log(`Retrieving all tasks for project: ${projectId}`);

    try {
      const tasks = await this.prismaService.task.findMany({
        where: { projectId },
        include: {
          taskAssignments: {
            include: {
              user: true, // Include user details for each assignment
            },
          },
          blockedBy: true,
          blocking: true,
          dependencies: true,
          dependentTasks: true,
          timeTracking: true,
        },
      });

      this.logger.debug(
        `Retrieved ${tasks.length} tasks for project: ${projectId}`,
      );
      return tasks;
    } catch (error) {
      this.logger.error(
        `Error retrieving tasks for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getTaskByIdForProject(projectId: string, taskId: string) {
    this.logger.log(`Retrieving task ${taskId} for project: ${projectId}`);

    try {
      const task = await this.prismaService.task.findUnique({
        where: { id: taskId, projectId },
        include: {
          taskAssignments: {
            include: {
              user: true,
            },
          },
          timeTracking: true,
        },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found in project ${projectId}`);
        return null;
      }

      this.logger.debug(`Retrieved task: ${task.name} (${taskId})`);
      return task;
    } catch (error) {
      this.logger.error(
        `Error retrieving task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateTaskForProject(
    projectId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ) {
    this.logger.log(`Updating task ${taskId} in project ${projectId}`);
    this.logger.debug(`Update data: ${JSON.stringify(updateTaskDto)}`);

    try {
      const { assignedUserIds, blockedTaskIds, ...taskData } = updateTaskDto;

      // Validate blocker tasks
      if (blockedTaskIds && blockedTaskIds.length > 0) {
        this.logger.debug(`Validating ${blockedTaskIds.length} blocker tasks`);
        const existingBlockerTasks = await this.prismaService.task.findMany({
          where: {
            id: { in: blockedTaskIds },
            projectId: projectId,
          },
        });

        if (existingBlockerTasks.length !== blockedTaskIds.length) {
          this.logger.warn(`Invalid blocker task IDs for task ${taskId}`);
          throw new BadRequestException(
            'Some blocked by task IDs are invalid or not in the same project',
          );
        }
      }

      // Update task core data
      const updatedTask = await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          ...taskData,
          blockedBy: blockedTaskIds
            ? {
                set: blockedTaskIds.map((id) => ({ id })),
              }
            : undefined,
        },
      });

      this.logger.debug(`Core task data updated for task ${taskId}`);

      // Handle user assignments
      if (assignedUserIds && assignedUserIds.length > 0) {
        this.logger.debug(
          `Updating assignments for task ${taskId} with ${assignedUserIds.length} users`,
        );

        // Verify users are valid
        const validUsers = await this.prismaService.user.findMany({
          where: {
            id: { in: assignedUserIds },
            memberships: {
              some: {
                team: {
                  projects: {
                    some: { id: projectId },
                  },
                },
              },
            },
          },
        });

        if (validUsers.length !== assignedUserIds.length) {
          this.logger.warn(`Invalid user assignments for task ${taskId}`);
          throw new BadRequestException(
            'Some user IDs are invalid or not part of the project',
          );
        }

        // Delete existing assignments
        await this.prismaService.taskAssignment.deleteMany({
          where: { taskId: taskId },
        });
        this.logger.debug(
          `Deleted existing task assignments for task ${taskId}`,
        );

        // Create new task assignments
        const taskAssignments = assignedUserIds.map((userId) => ({
          taskId: taskId,
          userId: userId,
        }));

        await this.prismaService.taskAssignment.createMany({
          data: taskAssignments,
        });
        this.logger.debug(
          `Created ${taskAssignments.length} new task assignments for task ${taskId}`,
        );

        // Send notifications to assigned users
        for (const userId of assignedUserIds) {
          this.logger.debug(
            `Sending notification to user ${userId} about task update`,
          );
          await this.notificationGateway.emitNotification(userId, {
            message: `Task updated: ${updatedTask.name}`,
            userId: userId,
            type: 'TASK_UPDATE',
          });
        }
      }

      this.logger.log(
        `Successfully updated task: ${updatedTask.name} (${taskId})`,
      );
      return updatedTask;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error updating task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteTaskForProject(projectId: string, taskId: string) {
    this.logger.log(`Deleting task ${taskId} from project ${projectId}`);

    try {
      // Get the task before deleting to access its name
      const task = await this.prismaService.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found for deletion`);
        throw new NotFoundException('Task not found');
      }

      this.logger.debug(`Found task for deletion: ${task.name} (${taskId})`);

      // Get assignees to notify before deleting assignments
      const assignees = await this.prismaService.taskAssignment.findMany({
        where: { taskId },
        select: { userId: true },
      });
      this.logger.debug(
        `Found ${assignees.length} assignees to notify about task deletion`,
      );

      // Delete related time tracking entries
      const timeTrackingResult =
        await this.prismaService.timeTracking.deleteMany({
          where: { taskId },
        });
      this.logger.debug(
        `Deleted ${timeTrackingResult.count} time tracking entries for task ${taskId}`,
      );

      // Delete task assignments
      const assignmentResult =
        await this.prismaService.taskAssignment.deleteMany({
          where: { taskId },
        });
      this.logger.debug(
        `Deleted ${assignmentResult.count} task assignments for task ${taskId}`,
      );

      // Send notifications to assignees
      for (const assignee of assignees) {
        this.logger.debug(
          `Sending deletion notification to user: ${assignee.userId}`,
        );
        await this.notificationGateway.emitNotification(assignee.userId, {
          message: `Task deleted: ${task.name}`,
          userId: assignee.userId,
          type: 'TASK_DELETED',
        });
      }

      // Finally delete the task
      const deletedTask = await this.prismaService.task.delete({
        where: { id: taskId },
      });

      this.logger.log(`Successfully deleted task: ${task.name} (${taskId})`);
      return deletedTask;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error deleting task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createTaskForProject(projectId: string, createTaskDto: CreateTaskDto) {
    this.logger.log(`Creating new task in project ${projectId}`);
    this.logger.debug(`Task creation data: ${JSON.stringify(createTaskDto)}`);

    try {
      const {
        assignedUserIds,
        blockedTaskIds,
        name = '',
        ...taskData
      } = createTaskDto;

      // Validate blocker tasks
      if (blockedTaskIds && blockedTaskIds.length > 0) {
        this.logger.debug(`Validating ${blockedTaskIds.length} blocker tasks`);
        const existingBlockerTasks = await this.prismaService.task.findMany({
          where: {
            id: { in: blockedTaskIds },
            projectId: projectId,
          },
        });

        if (existingBlockerTasks.length !== blockedTaskIds.length) {
          this.logger.warn(`Invalid blocker task IDs provided for new task`);
          throw new BadRequestException(
            'Some blocked by task IDs are invalid or not in the same project',
          );
        }
      }

      // Create the task
      const task = await this.prismaService.task.create({
        data: {
          ...taskData,
          projectId,
          name,
          blockedBy: blockedTaskIds
            ? {
                connect: blockedTaskIds.map((id) => ({ id })),
              }
            : undefined,
        },
      });

      this.logger.debug(`Created task: ${task.name} (${task.id})`);

      // Handle user assignments
      if (assignedUserIds && assignedUserIds.length > 0) {
        this.logger.debug(
          `Assigning task ${task.id} to ${assignedUserIds.length} users`,
        );

        // Verify users are valid
        const validUsers = await this.prismaService.user.findMany({
          where: {
            id: { in: assignedUserIds },
            memberships: {
              some: {
                team: {
                  projects: {
                    some: { id: projectId },
                  },
                },
              },
            },
          },
        });

        if (validUsers.length !== assignedUserIds.length) {
          this.logger.warn(`Invalid user assignments for new task ${task.id}`);
          throw new BadRequestException(
            'Some user IDs are invalid or not part of the project',
          );
        }

        // Create task assignments
        const taskAssignments = assignedUserIds.map((userId) => ({
          taskId: task.id,
          userId: userId,
        }));

        await this.prismaService.taskAssignment.createMany({
          data: taskAssignments,
        });
        this.logger.debug(
          `Created ${taskAssignments.length} task assignments for task ${task.id}`,
        );

        // Send notifications to assigned users
        for (const userId of assignedUserIds) {
          this.logger.debug(
            `Sending assignment notification to user: ${userId}`,
          );
          await this.notificationGateway.emitNotification(userId, {
            message: `You have been assigned to task: ${task.name}`,
            userId: userId,
            type: 'TASK_ASSIGNMENT',
          });
        }
      }

      this.logger.log(`Successfully created task: ${task.name} (${task.id})`);
      return task;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating task: ${error.message}`, error.stack);
      throw error;
    }
  }

  async assignTaskToUsers(
    projectId: string,
    taskId: string,
    assignTaskDto: { userIds: string[] },
  ) {
    this.logger.log(
      `Assigning task ${taskId} to users: ${assignTaskDto.userIds.join(', ')}`,
    );

    try {
      // Verify task exists
      const task = await this.prismaService.task.findUnique({
        where: { id: taskId, projectId },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found in project ${projectId}`);
        throw new NotFoundException('Task not found in the specified project');
      }

      this.logger.debug(`Found task for assignment: ${task.name} (${taskId})`);

      // Verify users are valid
      const validUsers = await this.prismaService.user.findMany({
        where: {
          id: { in: assignTaskDto.userIds },
          memberships: {
            some: {
              team: {
                projects: {
                  some: { id: projectId },
                },
              },
            },
          },
        },
      });

      if (validUsers.length !== assignTaskDto.userIds.length) {
        this.logger.warn(`Invalid user assignments for task ${taskId}`);
        throw new BadRequestException(
          'Some user IDs are invalid or not part of the project',
        );
      }

      this.logger.debug(
        `Validated ${validUsers.length} users for task assignment`,
      );

      // Delete existing assignments
      const deleteResult = await this.prismaService.taskAssignment.deleteMany({
        where: { taskId },
      });
      this.logger.debug(
        `Deleted ${deleteResult.count} existing task assignments`,
      );

      // Create new assignments
      await this.prismaService.taskAssignment.createMany({
        data: assignTaskDto.userIds.map((userId) => ({
          taskId,
          userId,
        })),
      });
      this.logger.debug(
        `Created ${assignTaskDto.userIds.length} new task assignments`,
      );

      // Send notifications to assigned users
      for (const userId of assignTaskDto.userIds) {
        this.logger.debug(`Sending assignment notification to user: ${userId}`);
        await this.notificationGateway.emitNotification(userId, {
          message: `You have been assigned to task: ${task.name}`,
          userId: userId,
          type: 'TASK_ASSIGNMENT',
        });
      }

      // Return updated task with assignments
      const updatedTask = await this.prismaService.task.findUnique({
        where: { id: taskId },
        include: {
          taskAssignments: {
            include: {
              user: true,
            },
          },
        },
      });

      this.logger.log(
        `Successfully assigned task ${taskId} to ${assignTaskDto.userIds.length} users`,
      );
      return updatedTask;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Error assigning task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async unassignTaskFromUser(projectId: string, taskId: string) {
    this.logger.log(
      `Unassigning all users from task ${taskId} in project ${projectId}`,
    );

    try {
      const result = await this.prismaService.taskAssignment.deleteMany({
        where: { taskId },
      });

      this.logger.debug(
        `Removed ${result.count} assignments from task ${taskId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error unassigning task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async moveTask(
    projectId: string,
    taskId: string,
    userId: string,
    status: TaskStatus,
  ) {
    this.logger.log(
      `Moving task ${taskId} to status ${status} by user ${userId}`,
    );

    try {
      // Verify task exists
      const task = await this.prismaService.task.findFirst({
        where: { id: taskId, projectId },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found in project ${projectId}`);
        throw new NotFoundException('Task not found in the specified project');
      }

      this.logger.debug(
        `Found task: ${task.name} (${taskId}) - current status: ${task.status}`,
      );

      // Verify user is assigned to task
      const taskAssignment = await this.prismaService.taskAssignment.findFirst({
        where: { taskId, userId },
      });

      if (!taskAssignment) {
        this.logger.warn(`User ${userId} is not assigned to task ${taskId}`);
        throw new BadRequestException('User is not assigned to the task');
      }

      const updateData: any = { status };

      // Add timestamps based on status changes
      if (status === TaskStatus.IN_PROGRESS && !task.startedAt) {
        updateData.startedAt = new Date();
        this.logger.debug(`Setting startedAt timestamp for task ${taskId}`);
      } else if (status === TaskStatus.DONE && !task.completedAt) {
        updateData.completedAt = new Date();
        this.logger.debug(`Setting completedAt timestamp for task ${taskId}`);

        // Calculate actual hours if task was started
        if (task.startedAt) {
          const startTime = new Date(task.startedAt);
          const endTime = new Date();
          const hoursSpent =
            (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          updateData.actualHours = hoursSpent;
          this.logger.debug(
            `Calculated actual hours: ${hoursSpent} for task ${taskId}`,
          );
        }
      }

      // Send appropriate notifications
      if (status === TaskStatus.IN_PROGRESS) {
        this.logger.debug(
          `Sending task started notification to user ${userId}`,
        );
        await this.notificationGateway.emitNotification(userId, {
          message: `Task started: ${task.name}`,
          userId: userId,
          type: 'TASK_STARTED',
        });
      } else if (status === TaskStatus.DONE) {
        // Notify all task assignees
        this.logger.debug(`Getting assignees to notify about task completion`);
        const assignees = await this.prismaService.taskAssignment.findMany({
          where: { taskId },
          select: { userId: true },
        });

        for (const assignee of assignees) {
          this.logger.debug(
            `Sending completion notification to user ${assignee.userId}`,
          );
          await this.notificationGateway.emitNotification(assignee.userId, {
            message: `Task completed: ${task.name}`,
            userId: assignee.userId,
            type: 'TASK_COMPLETED',
          });
        }
      }

      // Update task status
      const updatedTask = await this.prismaService.task.update({
        where: { id: taskId },
        data: updateData,
      });

      this.logger.log(`Successfully moved task ${taskId} to status ${status}`);
      return updatedTask;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Error moving task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async startTimeTracking(
    projectId: string,
    taskId: string,
    userId: string,
    timeTrackingDto: TimeTrackingDto,
  ) {
    this.logger.log(
      `Starting time tracking for task ${taskId} by user ${userId}`,
    );
    this.logger.debug(`Time tracking data: ${JSON.stringify(timeTrackingDto)}`);

    try {
      // Verify task exists
      const task = await this.prismaService.task.findFirst({
        where: { id: taskId, projectId },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found in project ${projectId}`);
        throw new NotFoundException('Task not found in the specified project');
      }

      this.logger.debug(`Found task: ${task.name} (${taskId})`);

      // Verify user is assigned to task
      const taskAssignment = await this.prismaService.taskAssignment.findFirst({
        where: { taskId, userId },
      });

      if (!taskAssignment) {
        this.logger.warn(`User ${userId} is not assigned to task ${taskId}`);
        throw new BadRequestException('User is not assigned to the task');
      }

      // Check if user has ongoing session
      const ongoingSession = await this.prismaService.timeTracking.findFirst({
        where: {
          taskId,
          userId,
          endTime: null,
        },
      });

      if (ongoingSession) {
        this.logger.warn(
          `User ${userId} already has ongoing session for task ${taskId}`,
        );
        throw new BadRequestException(
          'User already has an ongoing session for this task',
        );
      }

      // Send notification
      this.logger.debug(
        `Sending time tracking started notification to user ${userId}`,
      );
      await this.notificationGateway.emitNotification(userId, {
        message: `Time tracking started for task: ${task.name}`,
        userId: userId,
        type: 'TIME_TRACKING_STARTED',
      });

      // Create time tracking record
      const timeTrackingRecord = await this.prismaService.timeTracking.create({
        data: {
          taskId,
          userId,
          description: timeTrackingDto.description,
          startTime: timeTrackingDto.startTime || new Date(),
        },
      });

      this.logger.log(
        `Started time tracking session ${timeTrackingRecord.id} for task ${taskId}`,
      );
      return timeTrackingRecord;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Error starting time tracking for task ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async stopTimeTracking(
    projectId: string,
    taskId: string,
    userId: string,
    sessionId: string,
    timeTrackingDto: TimeTrackingDto,
  ) {
    this.logger.log(
      `Stopping time tracking session ${sessionId} for task ${taskId} by user ${userId}`,
    );

    try {
      // Find the session
      const session = await this.prismaService.timeTracking.findUnique({
        where: {
          id: sessionId,
          taskId,
          userId,
        },
      });

      if (!session) {
        this.logger.warn(`Time tracking session ${sessionId} not found`);
        throw new NotFoundException('Time tracking session not found');
      }

      this.logger.debug(`Found time tracking session ${sessionId}`);

      // Check if session is already completed
      if (session.endTime) {
        this.logger.warn(
          `Time tracking session ${sessionId} is already completed`,
        );
        throw new BadRequestException('Session is already completed');
      }

      // Calculate duration
      const endTime = timeTrackingDto.endTime || new Date();
      const startTime = new Date(session.startTime);
      const durationHours =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      this.logger.debug(
        `Calculated duration: ${durationHours.toFixed(2)} hours`,
      );

      // Fetch task for notification
      const task = await this.prismaService.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        this.logger.warn(
          `Task ${taskId} not found when stopping time tracking`,
        );
        throw new NotFoundException('Task not found');
      }

      // Send notification
      this.logger.debug(
        `Sending time tracking stopped notification to user ${userId}`,
      );
      await this.notificationGateway.emitNotification(userId, {
        message: `Time tracking stopped for task: ${task.name}. Duration: ${durationHours.toFixed(2)} hours`,
        userId: userId,
        type: 'TIME_TRACKING_STOPPED',
      });

      // Update time tracking record
      const updatedSession = await this.prismaService.timeTracking.update({
        where: { id: sessionId },
        data: {
          endTime,
          duration: durationHours,
          description: timeTrackingDto.description || session.description,
        },
      });

      this.logger.log(
        `Stopped time tracking session ${sessionId}, duration: ${durationHours.toFixed(2)} hours`,
      );
      return updatedSession;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Error stopping time tracking ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getTaskTimeStats(projectId: string, taskId: string) {
    this.logger.log(
      `Getting time stats for task ${taskId} in project ${projectId}`,
    );

    try {
      // Get task with time tracking data
      const task = await this.prismaService.task.findFirst({
        where: { id: taskId, projectId },
        include: {
          timeTracking: true,
        },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found in project ${projectId}`);
        throw new NotFoundException('Task not found in the specified project');
      }

      this.logger.debug(
        `Found task with ${task.timeTracking.length} time tracking entries`,
      );

      // Calculate time statistics
      let totalTrackedHours = 0;
      let ongoingSessions = 0;

      task.timeTracking.forEach((session) => {
        if (session.duration) {
          totalTrackedHours += session.duration;
        } else if (!session.endTime) {
          ongoingSessions++;
        }
      });

      this.logger.debug(
        `Calculated stats - tracked: ${totalTrackedHours}h, ongoing: ${ongoingSessions}`,
      );

      // Build statistics object
      const timeStats = {
        taskId: task.id,
        name: task.name,
        status: task.status,
        estimatedHours: task.estimatedHours || 0,
        actualHours: task.actualHours || 0,
        trackedHours: totalTrackedHours,
        dueDate: task.dueDate,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        ongoingSessions,
        sessionsCount: task.timeTracking.length,
        efficiency:
          task.estimatedHours && task.actualHours
            ? ((task.estimatedHours / task.actualHours) * 100).toFixed(2) + '%'
            : 'N/A',
      };

      this.logger.debug(
        `Time stats calculated successfully for task ${taskId}`,
      );
      return timeStats;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting task time stats for ${taskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProjectTimeStats(projectId: string) {
    this.logger.log(`Getting time stats for project ${projectId}`);

    try {
      // Get all tasks with time tracking data
      const tasks = await this.prismaService.task.findMany({
        where: { projectId },
        include: {
          timeTracking: true,
        },
      });

      this.logger.debug(`Found ${tasks.length} tasks for project ${projectId}`);

      // Calculate project statistics
      let totalEstimatedHours = 0;
      let totalActualHours = 0;
      let totalTrackedHours = 0;
      let completedTasks = 0;
      let ongoingSessions = 0;

      tasks.forEach((task) => {
        if (task.estimatedHours) totalEstimatedHours += task.estimatedHours;
        if (task.actualHours) totalActualHours += task.actualHours;

        task.timeTracking.forEach((session) => {
          if (session.duration) {
            totalTrackedHours += session.duration;
          } else if (!session.endTime) {
            ongoingSessions++;
          }
        });

        if (task.status === TaskStatus.DONE) {
          completedTasks++;
        }
      });

      this.logger.debug(
        `Calculated stats - estimated: ${totalEstimatedHours}h, actual: ${totalActualHours}h, tracked: ${totalTrackedHours}h`,
      );

      // Build project statistics object
      const projectStats = {
        projectId,
        totalTasks: tasks.length,
        completedTasks,
        inProgressTasks: tasks.filter(
          (t) => t.status === TaskStatus.IN_PROGRESS,
        ).length,
        todoTasks: tasks.filter((t) => t.status === TaskStatus.TODO).length,
        totalEstimatedHours,
        totalActualHours,
        totalTrackedHours,
        ongoingSessions,
        projectEfficiency:
          totalEstimatedHours && totalActualHours
            ? ((totalEstimatedHours / totalActualHours) * 100).toFixed(2) + '%'
            : 'N/A',
        averageTaskDuration:
          completedTasks > 0
            ? (totalActualHours / completedTasks).toFixed(2)
            : 'N/A',
      };

      this.logger.debug(
        `Project time stats calculated successfully for project ${projectId}`,
      );
      return projectStats;
    } catch (error) {
      this.logger.error(
        `Error getting project time stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
