import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AssignTaskDto,
} from '../tasks/dto/tasks.dto';
import { NotificationGateway } from 'src/notification/notification-gateway';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prismaService: PrismaService,
    private notificationGateway: NotificationGateway,
    private logger: LoggerService,
  ) {
    this.logger.setContext('ProjectsService');
  }

  async getAllProjects() {
    this.logger.log('Retrieving all projects');

    try {
      const projects = await this.prismaService.project.findMany();
      this.logger.debug(`Retrieved ${projects.length} projects`);
      return projects;
    } catch (error) {
      this.logger.error(
        `Error retrieving projects: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProjectById(projectId: string) {
    this.logger.log(`Retrieving project with ID: ${projectId}`);

    try {
      const project = await this.prismaService.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        this.logger.warn(`Project with ID ${projectId} not found`);
        throw new NotFoundException('Project not found');
      }

      this.logger.debug(`Retrieved project: ${project.name} (${projectId})`);
      return project;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error retrieving project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createProject(createProjectDto: CreateProjectDto) {
    this.logger.log(`Creating new project: ${createProjectDto.name}`);

    try {
      const project = await this.prismaService.project.create({
        data: createProjectDto,
      });

      this.logger.debug(`Project created: ${project.name} (${project.id})`);

      // Find team members to notify about the new project
      this.logger.debug(`Finding team members for team ID: ${project.teamId}`);
      const teamMembers = await this.prismaService.teamMembership.findMany({
        where: {
          teamId: project.teamId,
          status: 'active',
        },
        select: {
          userId: true,
        },
      });

      this.logger.debug(`Found ${teamMembers.length} team members to notify`);

      // Notify all team members about the new project
      for (const member of teamMembers) {
        this.logger.debug(`Sending notification to user: ${member.userId}`);
        await this.notificationGateway.emitNotification(member.userId, {
          message: `New project created: ${project.name}`,
          userId: member.userId,
          type: 'PROJECT_CREATED',
        });
      }

      return project;
    } catch (error) {
      this.logger.error(
        `Error creating project ${createProjectDto.name}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateProject(projectId: string, updateProjectDto: UpdateProjectDto) {
    this.logger.log(`Updating project with ID: ${projectId}`);

    try {
      const project = await this.prismaService.project.update({
        where: { id: projectId },
        data: updateProjectDto,
      });

      this.logger.debug(`Project updated: ${project.name} (${project.id})`);

      // Get team members to notify
      this.logger.debug(`Finding team members for team ID: ${project.teamId}`);
      const teamMembers = await this.prismaService.teamMembership.findMany({
        where: {
          teamId: project.teamId,
          status: 'active',
        },
        select: {
          userId: true,
        },
      });

      this.logger.debug(
        `Found ${teamMembers.length} team members to notify about update`,
      );

      // Notify team members about project update
      for (const member of teamMembers) {
        this.logger.debug(
          `Sending update notification to user: ${member.userId}`,
        );
        await this.notificationGateway.emitNotification(member.userId, {
          message: `Project updated: ${project.name}`,
          userId: member.userId,
          type: 'PROJECT_UPDATED',
        });
      }

      return project;
    } catch (error) {
      this.logger.error(
        `Error updating project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteProject(projectId: string) {
    this.logger.log(`Deleting project with ID: ${projectId}`);

    try {
      // Get project details before deletion
      const project = await this.prismaService.project.findUnique({
        where: { id: projectId },
        include: {
          team: true,
        },
      });

      if (!project) {
        this.logger.warn(`Project with ID ${projectId} not found for deletion`);
        throw new NotFoundException('Project not found');
      }

      this.logger.debug(
        `Found project for deletion: ${project.name} (${project.id})`,
      );

      // Get team members to notify
      this.logger.debug(`Finding team members for team ID: ${project.teamId}`);
      const teamMembers = await this.prismaService.teamMembership.findMany({
        where: {
          teamId: project.teamId,
          status: 'active',
        },
        select: {
          userId: true,
        },
      });

      this.logger.debug(
        `Found ${teamMembers.length} team members to notify about deletion`,
      );

      // Delete the project
      await this.prismaService.project.delete({
        where: { id: projectId },
      });

      this.logger.debug(
        `Project deleted from database: ${project.name} (${projectId})`,
      );

      // Notify team members about project deletion
      for (const member of teamMembers) {
        this.logger.debug(
          `Sending deletion notification to user: ${member.userId}`,
        );
        await this.notificationGateway.emitNotification(member.userId, {
          message: `Project deleted: ${project.name}`,
          userId: member.userId,
          type: 'PROJECT_DELETED',
        });
      }

      this.logger.log(
        `Successfully deleted project: ${project.name} (${projectId})`,
      );
      return { message: 'Project deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error deleting project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addTeamToProject(projectId: string, teamId: string) {
    this.logger.log(`Adding team ${teamId} to project ${projectId}`);

    try {
      const project = await this.prismaService.project.update({
        where: { id: projectId },
        data: {
          teamId,
        },
        include: {
          team: true,
        },
      });

      this.logger.debug(`Team ${teamId} added to project ${projectId}`);

      // Notify team members about being added to a project
      this.logger.debug(`Finding team members for team ID: ${teamId}`);
      const teamMembers = await this.prismaService.teamMembership.findMany({
        where: {
          teamId,
          status: 'active',
        },
        select: {
          userId: true,
        },
      });

      this.logger.debug(`Found ${teamMembers.length} team members to notify`);

      for (const member of teamMembers) {
        this.logger.debug(
          `Sending team assignment notification to user: ${member.userId}`,
        );
        await this.notificationGateway.emitNotification(member.userId, {
          message: `Your team ${project.team.name} has been added to project: ${project.name}`,
          userId: member.userId,
          type: 'TEAM_ADDED_TO_PROJECT',
        });
      }

      this.logger.log(
        `Successfully added team ${project.team.name} to project ${project.name}`,
      );
      return project;
    } catch (error) {
      this.logger.error(
        `Error adding team ${teamId} to project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProjectTasks(projectId: string) {
    this.logger.log(`Retrieving tasks for project: ${projectId}`);

    try {
      // First check if the project exists
      const project = await this.prismaService.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        this.logger.warn(
          `Project with ID ${projectId} not found when fetching tasks`,
        );
        throw new NotFoundException('Project not found');
      }

      const tasks = await this.prismaService.task.findMany({
        where: { projectId },
        include: {
          taskAssignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          blockedBy: true,
          blocking: true,
          timeTracking: true,
        },
      });

      this.logger.debug(
        `Retrieved ${tasks.length} tasks for project ${projectId}`,
      );
      return tasks;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error retrieving tasks for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
