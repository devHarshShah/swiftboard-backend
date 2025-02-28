import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import {
  CreateTaskDto,
  UpdateTaskDto,
  AssignTaskDto,
} from '../tasks/dto/tasks.dto';

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
}
