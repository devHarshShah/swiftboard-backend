import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import { CreateTaskDto, UpdateTaskDto, AssignTaskDto } from './dto/tasks.dto';

@Injectable()
export class ProjectsService {
  constructor(private prismaService: PrismaService) {}

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
    return await this.prismaService.project.create({
      data: createProjectDto,
    });
  }

  async updateProject(projectId: string, updateProjectDto: UpdateProjectDto) {
    return await this.prismaService.project.update({
      where: { id: projectId },
      data: updateProjectDto,
    });
  }

  async deleteProject(projectId: string) {
    return await this.prismaService.project.delete({
      where: { id: projectId },
    });
  }

  async getAllTasksForProject(projectId: string) {
    return await this.prismaService.task.findMany({
      where: { projectId },
    });
  }

  async getTaskByIdForProject(projectId: string, taskId: string) {
    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async createTaskForProject(projectId: string, createTaskDto: CreateTaskDto) {
    return await this.prismaService.task.create({
      data: {
        ...createTaskDto,
        projectId,
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
    return await this.prismaService.task.delete({
      where: { id: taskId },
    });
  }

  async assignTaskToUser(
    projectId: string,
    taskId: string,
    assignTaskDto: AssignTaskDto,
  ) {
    return await this.prismaService.taskAssignment.create({
      data: {
        taskId,
        userId: assignTaskDto.userId,
      },
    });
  }

  async unassignTaskFromUser(projectId: string, taskId: string) {
    return await this.prismaService.taskAssignment.deleteMany({
      where: { taskId },
    });
  }
}
