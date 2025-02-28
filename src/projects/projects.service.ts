import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectsService {
  getAllProjects() {
    return 'All projects';
  }

  getProjectById(projectId: string) {
    return `Project with ID ${projectId}`;
  }

  createProject(createProjectDto: any) {
    return `Project created with ${createProjectDto}`;
  }

  updateProject(projectId: string, updateProjectDto: any) {
    return `Project with ID ${projectId} updated with ${updateProjectDto}`;
  }

  deleteProject(projectId: string) {
    return `Project with ID ${projectId} deleted`;
  }

  getAllTasksForProject(projectId: string) {
    return `All tasks for project with ID ${projectId}`;
  }

  getTaskByIdForProject(projectId: string, taskId: string) {
    return `Task with ID ${taskId} for project with ID ${projectId}`;
  }

  createTaskForProject(projectId: string, createTaskDto: any) {
    return `Task created for project with ID ${projectId} with ${createTaskDto}`;
  }

  updateTaskForProject(projectId: string, taskId: string, updateTaskDto: any) {
    return `Task with ID ${taskId} for project with ID ${projectId} updated with ${updateTaskDto}`;
  }

  deleteTaskForProject(projectId: string, taskId: string) {
    return `Task with ID ${taskId} for project with ID ${projectId} deleted`;
  }

  getAllMembersForProject(projectId: string) {
    return `All members for project with ID ${projectId}`;
  }

  getMemberForProject(projectId: string, memberId: string) {
    return `Member with ID ${memberId} for project with ID ${projectId}`;
  }

  addMemberToProject(projectId: string, addMemberDto: any) {
    return `Member added to project with ID ${projectId} with ${addMemberDto}`;
  }

  removeMemberFromProject(projectId: string, memberId: string) {
    return `Member with ID ${memberId} removed from project with ID ${projectId}`;
  }

  getAllTeamsForProject(projectId: string) {
    return `All teams for project with ID ${projectId}`;
  }

  getTeamForProject(projectId: string, teamId: string) {
    return `Team with ID ${teamId} for project with ID ${projectId}`;
  }

  addTeamToProject(projectId: string, addTeamDto: any) {
    return `Team added to project with ID ${projectId} with ${addTeamDto}`;
  }

  removeTeamFromProject(projectId: string, teamId: string) {
    return `Team with ID ${teamId} removed from project with ID ${projectId}`;
  }

  assignTaskToUser(projectId: string, taskId: string, assignTaskDto: any) {
    return `Task with ID ${taskId} assigned to user for project with ID ${projectId} with ${assignTaskDto}`;
  }

  unassignTaskFromUser(projectId: string, taskId: string) {
    return `Task with ID ${taskId} removed from user for project with ID ${projectId}`;
  }
}
