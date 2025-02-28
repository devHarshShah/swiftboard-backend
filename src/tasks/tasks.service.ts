import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, AssignTaskDto } from './dto/tasks.dto';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class TasksService {
  constructor(private prismaService: PrismaService) {}
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

  async completeTask(projectId: string, taskId: string, userId: string) {
    const taskAssignment = await this.prismaService.taskAssignment.findFirst({
      where: { taskId, userId },
    });

    if (!taskAssignment) {
      throw new NotFoundException('Task not assigned to the user');
    }

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: { completed: true },
    });

    await this.prismaService.subTask.updateMany({
      where: { taskId },
      data: { completed: true },
    });

    return updatedTask;
  }
}
