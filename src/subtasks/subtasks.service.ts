import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubTaskDto, UpdateSubTaskDto } from './dto/subtask.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubtasksService {
  constructor(private prisma: PrismaService) {}

  async getAllSubtasksForTask(projectId: string, taskId: string) {
    return await this.prisma.subTask.findMany({
      where: { taskId },
    });
  }

  async getSubtaskByIdForTask(
    projectId: string,
    taskId: string,
    subtaskId: string,
  ) {
    const subtask = await this.prisma.subTask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!subtask) {
      throw new NotFoundException('Subtask not found');
    }
    return subtask;
  }

  async createSubtaskForTask(
    projectId: string,
    taskId: string,
    createSubtaskDto: CreateSubTaskDto,
  ) {
    return await this.prisma.subTask.create({
      data: {
        name: createSubtaskDto.name,
        taskId,
      },
    });
  }

  async updateSubtaskForTask(
    projectId: string,
    taskId: string,
    subtaskId: string,
    updateSubtaskDto: UpdateSubTaskDto,
  ) {
    return await this.prisma.subTask.update({
      where: { id: subtaskId, taskId },
      data: updateSubtaskDto,
    });
  }

  async deleteSubtaskForTask(
    projectId: string,
    taskId: string,
    subtaskId: string,
  ) {
    return await this.prisma.subTask.delete({
      where: { id: subtaskId, taskId },
    });
  }

  async completeSubtask(projectId: string, taskId: string, subtaskId: string) {
    return await this.prisma.subTask.update({
      where: { id: subtaskId, taskId },
      data: { completed: true },
    });
  }
}
