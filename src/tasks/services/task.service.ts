import { Injectable, HttpStatus } from '@nestjs/common';
import { BaseService } from '../../common/services/base.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class TaskService extends BaseService {
  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    super(logger);
  }

  async findAll(projectId: string, userId: string) {
    // First validate user has access to the project
    await this.validateProjectAccess(projectId, userId);

    return this.executeDbOperation(
      () =>
        this.prisma.task.findMany({
          where: { projectId },
          include: {
            taskAssignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            timeTracking: true,
            files: true,
            dependencies: true,
            dependentTasks: true,
            blockedBy: true,
            blocking: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      'Failed to retrieve tasks',
      { projectId, userId },
    );
  }

  async create(data: any, userId: string) {
    // Validate business rules
    this.validateBusinessRule(
      data.name && data.name.length <= 200,
      'Task name is required and cannot exceed 200 characters',
      'INVALID_TASK_NAME',
    );

    // Validate project access
    await this.validateProjectAccess(data.projectId, userId);

    // If assignees are provided, validate they're project members
    const assigneeIds = data.assigneeIds || [];
    if (assigneeIds.length > 0) {
      for (const assigneeId of assigneeIds) {
        await this.validateUserInTeam(data.projectId, assigneeId);
      }
    }

    // Handle dependencies if provided
    const dependencies = data.dependencies || [];
    const blockedBy = data.blockedBy || [];

    return this.executeDbOperation(
      () =>
        this.prisma.task.create({
          data: {
            name: data.name,
            description: data.description,
            status: data.status || TaskStatus.TODO,
            dueDate: data.dueDate,
            projectId: data.projectId,
            metadata: data.metadata,
            estimatedHours: data.estimatedHours,
            taskAssignments: {
              create: assigneeIds.map((id) => ({
                userId: id,
                assignedBy: userId,
              })),
            },
            dependencies: {
              connect: dependencies.map((id) => ({ id })),
            },
            blockedBy: {
              connect: blockedBy.map((id) => ({ id })),
            },
          },
          include: {
            taskAssignments: {
              include: {
                user: true,
              },
            },
          },
        }),
      'Failed to create task',
      { taskData: data, userId },
    );
  }

  async findById(taskId: string, userId: string) {
    const task = await this.executeDbOperation(
      () =>
        this.prisma.task.findUnique({
          where: { id: taskId },
          include: {
            taskAssignments: {
              include: {
                user: true,
              },
            },
            project: {
              include: {
                team: {
                  include: {
                    memberships: true,
                  },
                },
              },
            },
            timeTracking: true,
            files: true,
            dependencies: true,
            dependentTasks: true,
            blockedBy: true,
            blocking: true,
          },
        }),
      'Failed to retrieve task',
      { taskId, userId },
    );

    this.validateBusinessRule(
      task !== null,
      'Task not found',
      'TASK_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    // TypeScript now knows that project is included in the task result
    const taskWithProject = task as any;
    this.validateBusinessRule(
      taskWithProject.project.team.memberships.some(
        (member) => member.userId === userId,
      ),
      'You do not have access to this task',
      'TASK_ACCESS_DENIED',
      HttpStatus.FORBIDDEN,
    );

    return task;
  }

  async updateStatus(taskId: string, status: TaskStatus, userId: string) {
    // First get the task to check access and current status
    const task = await this.findById(taskId, userId);

    const updates: any = { status };

    // Handle status-specific timestamp updates
    if (status === TaskStatus.IN_PROGRESS && !task!.startedAt) {
      updates.startedAt = new Date();
    } else if (status === TaskStatus.DONE && !task!.completedAt) {
      updates.completedAt = new Date();
    }

    return this.executeDbOperation(
      () =>
        this.prisma.task.update({
          where: { id: taskId },
          data: updates,
          include: {
            taskAssignments: {
              include: {
                user: true,
              },
            },
          },
        }),
      'Failed to update task status',
      { taskId, status, userId },
    );
  }

  async addTimeTracking(
    taskId: string,
    userId: string,
    hours: number,
    description?: string,
  ) {
    // Validate task access
    await this.findById(taskId, userId);

    this.validateBusinessRule(
      hours > 0,
      'Hours must be greater than 0',
      'INVALID_HOURS',
    );

    return this.executeDbOperation(
      () =>
        this.prisma.timeTracking.create({
          data: {
            description,
            taskId,
            userId,
            startTime: new Date(),
            duration: hours,
          },
        }),
      'Failed to add time tracking',
      { taskId, userId, hours },
    );
  }

  private async validateProjectAccess(projectId: string, userId: string) {
    const project = await this.executeDbOperation(
      () =>
        this.prisma.project.findFirst({
          where: {
            id: projectId,
            team: {
              memberships: {
                some: {
                  userId,
                },
              },
            },
          },
        }),
      'Failed to validate project access',
      { projectId, userId },
    );

    this.validateBusinessRule(
      project !== null,
      'Project not found or you do not have access',
      'PROJECT_ACCESS_DENIED',
      HttpStatus.FORBIDDEN,
    );
  }

  private async validateUserInTeam(projectId: string, userId: string) {
    const project = await this.executeDbOperation(
      () =>
        this.prisma.project.findUnique({
          where: { id: projectId },
          include: {
            team: {
              include: {
                memberships: true,
              },
            },
          },
        }),
      'Failed to validate user in team',
      { projectId, userId },
    );

    this.validateBusinessRule(
      project !== null &&
        project.team.memberships.some((m) => m.userId === userId),
      'User must be a member of the project team',
      'INVALID_TEAM_MEMBER',
      HttpStatus.BAD_REQUEST,
    );
  }
}
