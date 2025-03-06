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

@Injectable()
export class TasksService {
  constructor(private prismaService: PrismaService) {}

  async getAllTasksForProject(projectId: string) {
    return await this.prismaService.task.findMany({
      where: { projectId },
      include: {
        taskAssignments: {
          include: {
            user: true, // Include user details for each assignment
          },
        },
        blockedBy: true, // Include tasks blocking this task
        blocking: true, // Include tasks this task is blocking
        dependencies: true, // Include tasks this task depends on
        dependentTasks: true, // Include tasks dependent on this task
        timeTracking: true, // Include time tracking data
      },
    });
  }

  async getTaskByIdForProject(projectId: string, taskId: string) {
    return await this.prismaService.task.findUnique({
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
  }

  async updateTaskForProject(
    projectId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ) {
    const { assignedUserIds, blockedTaskIds, ...taskData } = updateTaskDto;

    // Validate blocked by tasks exist and are in the same project
    if (blockedTaskIds && blockedTaskIds.length > 0) {
      const existingBlockerTasks = await this.prismaService.task.findMany({
        where: {
          id: { in: blockedTaskIds },
          projectId: projectId, // Ensure blockers are in the same project
        },
      });

      if (existingBlockerTasks.length !== blockedTaskIds.length) {
        throw new BadRequestException(
          'Some blocked by task IDs are invalid or not in the same project',
        );
      }
    }

    // Update the task with dependencies
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

    // Handle task assignments
    if (assignedUserIds && assignedUserIds.length > 0) {
      // Validate user IDs exist and are part of the team memberships that have access to the project
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
        throw new BadRequestException(
          'Some user IDs are invalid or not part of the project',
        );
      }

      // First, remove existing task assignments
      await this.prismaService.taskAssignment.deleteMany({
        where: { taskId: taskId },
      });

      // Create new task assignments
      const taskAssignments = assignedUserIds.map((userId) => ({
        taskId: taskId,
        userId: userId,
      }));

      await this.prismaService.taskAssignment.createMany({
        data: taskAssignments,
      });
    }

    return updatedTask;
  }

  async deleteTaskForProject(projectId: string, taskId: string) {
    // Delete time tracking associated with the task
    await this.prismaService.timeTracking.deleteMany({
      where: { taskId },
    });

    // Delete task assignments associated with the task
    await this.prismaService.taskAssignment.deleteMany({
      where: { taskId },
    });

    // Delete the task
    return await this.prismaService.task.delete({
      where: { id: taskId },
    });
  }

  async createTaskForProject(projectId: string, createTaskDto: CreateTaskDto) {
    const {
      assignedUserIds,
      blockedTaskIds,
      name = '',
      ...taskData
    } = createTaskDto;

    console.log('blockedTaskIds', blockedTaskIds);

    // Validate blocked by tasks exist and are in the same project
    if (blockedTaskIds && blockedTaskIds.length > 0) {
      const existingBlockerTasks = await this.prismaService.task.findMany({
        where: {
          id: { in: blockedTaskIds },
          projectId: projectId, // Ensure blockers are in the same project
        },
      });

      if (existingBlockerTasks.length !== blockedTaskIds.length) {
        throw new BadRequestException(
          'Some blocked by task IDs are invalid or not in the same project',
        );
      }
    }

    // Create the task with dependencies
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

    // Rest of your existing code for task assignments
    if (assignedUserIds && assignedUserIds.length > 0) {
      // Validate user IDs exist and are part of the team memberships that have access to the project
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
    }

    return task;
  }

  async assignTaskToUsers(
    projectId: string,
    taskId: string,
    assignTaskDto: { userIds: string[] },
  ) {
    // Verify the task exists and belongs to the project
    const task = await this.prismaService.task.findUnique({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new NotFoundException('Task not found in the specified project');
    }

    // Validate user IDs exist and are part of the project
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
      throw new BadRequestException(
        'Some user IDs are invalid or not part of the project',
      );
    }

    // Remove existing assignments to avoid duplicates
    await this.prismaService.taskAssignment.deleteMany({
      where: { taskId },
    });

    // Create new task assignments
    await this.prismaService.taskAssignment.createMany({
      data: assignTaskDto.userIds.map((userId) => ({
        taskId,
        userId,
      })),
    });

    return this.prismaService.task.findUnique({
      where: { id: taskId },
      include: {
        taskAssignments: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async unassignTaskFromUser(projectId: string, taskId: string) {
    return await this.prismaService.taskAssignment.deleteMany({
      where: { taskId },
    });
  }

  async moveTask(
    projectId: string,
    taskId: string,
    userId: string,
    status: TaskStatus,
  ) {
    // Verify the task exists and belongs to the project
    const task = await this.prismaService.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new NotFoundException('Task not found in the specified project');
    }

    // Verify the user is assigned to the task
    const taskAssignment = await this.prismaService.taskAssignment.findFirst({
      where: { taskId, userId },
    });

    if (!taskAssignment) {
      throw new BadRequestException('User is not assigned to the task');
    }

    // Prepare update data based on status change
    const updateData: any = { status };

    // Track time based on status changes
    if (status === TaskStatus.IN_PROGRESS && !task.startedAt) {
      // When task moves to IN_PROGRESS for the first time, record start time
      updateData.startedAt = new Date();
    } else if (status === TaskStatus.DONE && !task.completedAt) {
      // When task moves to DONE, record completion time
      updateData.completedAt = new Date();

      // Calculate actual hours if we have startedAt time
      if (task.startedAt) {
        const startTime = new Date(task.startedAt);
        const endTime = new Date();
        const hoursSpent =
          (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        updateData.actualHours = hoursSpent;
      }
    }

    // Update task with new status and time tracking information
    return await this.prismaService.task.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  // New methods for time tracking
  async startTimeTracking(
    projectId: string,
    taskId: string,
    userId: string,
    timeTrackingDto: TimeTrackingDto,
  ) {
    // Verify the task exists and belongs to the project
    const task = await this.prismaService.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new NotFoundException('Task not found in the specified project');
    }

    // Verify the user is assigned to the task
    const taskAssignment = await this.prismaService.taskAssignment.findFirst({
      where: { taskId, userId },
    });

    if (!taskAssignment) {
      throw new BadRequestException('User is not assigned to the task');
    }

    // Check if there's an ongoing time tracking session for this user and task
    const ongoingSession = await this.prismaService.timeTracking.findFirst({
      where: {
        taskId,
        userId,
        endTime: null,
      },
    });

    if (ongoingSession) {
      throw new BadRequestException(
        'User already has an ongoing session for this task',
      );
    }

    // Create a new time tracking session
    return await this.prismaService.timeTracking.create({
      data: {
        taskId,
        userId,
        description: timeTrackingDto.description,
        startTime: timeTrackingDto.startTime || new Date(),
      },
    });
  }

  async stopTimeTracking(
    projectId: string,
    taskId: string,
    userId: string,
    sessionId: string,
    timeTrackingDto: TimeTrackingDto,
  ) {
    // Find the ongoing session
    const session = await this.prismaService.timeTracking.findUnique({
      where: {
        id: sessionId,
        taskId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Time tracking session not found');
    }

    if (session.endTime) {
      throw new BadRequestException('Session is already completed');
    }

    const endTime = timeTrackingDto.endTime || new Date();
    const startTime = new Date(session.startTime);
    const durationHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Update the session with end time and duration
    return await this.prismaService.timeTracking.update({
      where: { id: sessionId },
      data: {
        endTime,
        duration: durationHours,
        description: timeTrackingDto.description || session.description,
      },
    });
  }

  async getTaskTimeStats(projectId: string, taskId: string) {
    // Verify the task exists and belongs to the project
    const task = await this.prismaService.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        timeTracking: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found in the specified project');
    }

    // Calculate total tracked time
    let totalTrackedHours = 0;
    let ongoingSessions = 0;

    task.timeTracking.forEach((session) => {
      if (session.duration) {
        totalTrackedHours += session.duration;
      } else if (!session.endTime) {
        ongoingSessions++;
      }
    });

    // Prepare stats
    return {
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
  }

  async getProjectTimeStats(projectId: string) {
    // Get all tasks for the project with time tracking data
    const tasks = await this.prismaService.task.findMany({
      where: { projectId },
      include: {
        timeTracking: true,
      },
    });

    // Calculate project-wide stats
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

    // Prepare project stats
    return {
      projectId,
      totalTasks: tasks.length,
      completedTasks,
      inProgressTasks: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS)
        .length,
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
  }
}
