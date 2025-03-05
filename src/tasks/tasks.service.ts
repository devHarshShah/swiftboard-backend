import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, AssignTaskDto } from './dto/tasks.dto';
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
      },
    });
  }

  async updateTaskForProject(
    projectId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ) {
    return await this.prismaService.task.update({
      where: { id: taskId },
      data: updateTaskDto,
    });
  }

  async deleteTaskForProject(projectId: string, taskId: string) {
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
    const { assignedUserIds, blockedTaskIds, ...taskData } = createTaskDto;

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

    // Correct way to update status
    return await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        status: status, // Explicitly specify status key
      },
    });
  }
}
