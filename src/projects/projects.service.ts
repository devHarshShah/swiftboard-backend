import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AssignTaskDto,
} from '../tasks/dto/tasks.dto';
import { NotificationGateway } from 'src/notification/notification-gateway';

@Injectable()
export class ProjectsService {
  constructor(
    private prismaService: PrismaService,
    private notificationGateway: NotificationGateway,
  ) {}

  async getAllProjects() {
    return await this.prismaService.project.findMany();
  }

  async getProjectById(projectId: string) {
    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async createProject(createProjectDto: CreateProjectDto) {
    const project = await this.prismaService.project.create({
      data: createProjectDto,
    });

    // Find team members to notify about the new project
    const teamMembers = await this.prismaService.teamMembership.findMany({
      where: {
        teamId: project.teamId,
        status: 'active',
      },
      select: {
        userId: true,
      },
    });

    // Notify all team members about the new project
    for (const member of teamMembers) {
      await this.notificationGateway.emitNotification(member.userId, {
        message: `New project created: ${project.name}`,
        userId: member.userId,
        type: 'PROJECT_CREATED',
      });
    }

    return project;
  }

  async updateProject(projectId: string, updateProjectDto: UpdateProjectDto) {
    const project = await this.prismaService.project.update({
      where: { id: projectId },
      data: updateProjectDto,
    });

    // Get team members to notify
    const teamMembers = await this.prismaService.teamMembership.findMany({
      where: {
        teamId: project.teamId,
        status: 'active',
      },
      select: {
        userId: true,
      },
    });

    // Notify team members about project update
    for (const member of teamMembers) {
      await this.notificationGateway.emitNotification(member.userId, {
        message: `Project updated: ${project.name}`,
        userId: member.userId,
        type: 'PROJECT_UPDATED',
      });
    }

    return project;
  }

  async deleteProject(projectId: string) {
    // Get project details before deletion
    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: {
        team: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Get team members to notify
    const teamMembers = await this.prismaService.teamMembership.findMany({
      where: {
        teamId: project.teamId,
        status: 'active',
      },
      select: {
        userId: true,
      },
    });

    // Delete the project
    await this.prismaService.project.delete({
      where: { id: projectId },
    });

    // Notify team members about project deletion
    for (const member of teamMembers) {
      await this.notificationGateway.emitNotification(member.userId, {
        message: `Project deleted: ${project.name}`,
        userId: member.userId,
        type: 'PROJECT_DELETED',
      });
    }

    return { message: 'Project deleted successfully' };
  }

  async addTeamToProject(projectId: string, teamId: string) {
    const project = await this.prismaService.project.update({
      where: { id: projectId },
      data: {
        teamId,
      },
      include: {
        team: true,
      },
    });

    // Notify team members about being added to a project
    const teamMembers = await this.prismaService.teamMembership.findMany({
      where: {
        teamId,
        status: 'active',
      },
      select: {
        userId: true,
      },
    });

    for (const member of teamMembers) {
      await this.notificationGateway.emitNotification(member.userId, {
        message: `Your team ${project.team.name} has been added to project: ${project.name}`,
        userId: member.userId,
        type: 'TEAM_ADDED_TO_PROJECT',
      });
    }

    return project;
  }
}
