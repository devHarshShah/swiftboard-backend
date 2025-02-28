import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async getAllTeams() {
    return await this.prisma.team.findMany();
  }

  async getTeamById(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async createTeam(createTeamDto) {
    return await this.prisma.team.create({
      data: createTeamDto,
    });
  }

  async updateTeam(teamId: string, updateTeamDto) {
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: updateTeamDto,
    });
    if (!team) throw new NotFoundException('Team not found or update failed');
    return team;
  }

  async deleteTeam(teamId: string) {
    await this.getTeamById(teamId); // Ensure the team exists
    await this.prisma.team.delete({ where: { id: teamId } });
    return { message: 'Team successfully deleted' };
  }

  async addMemberToTeam(teamId: string, memberId: string) {
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: {
        memberships: {
          connect: { id: memberId },
        },
      },
      include: { memberships: true },
    });
    return team;
  }

  async removeMemberFromTeam(teamId: string, memberId: string) {
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: {
        memberships: {
          disconnect: { id: memberId },
        },
      },
      include: { memberships: true },
    });
    return team;
  }

  async getTeamMembers(teamId: string) {
    const team = await this.getTeamById(teamId);
    return await this.prisma.team.findUnique({
      where: { id: team.id },
      include: { memberships: true },
    });
  }

  async getTeamProjects(teamId: string) {
    const team = await this.getTeamById(teamId);
    return await this.prisma.team.findUnique({
      where: { id: team.id },
      include: { projects: true },
    });
  }

  async getTeamTasks(teamId: string) {
    const team = await this.getTeamById(teamId);
    const fullTeam = await this.prisma.team.findUnique({
      where: { id: team.id },
      include: { projects: { include: { tasks: true } } },
    });

    if (!fullTeam || !fullTeam.projects) return [];
    return fullTeam.projects.flatMap((project) => project.tasks);
  }
}
