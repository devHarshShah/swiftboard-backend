import { Injectable, HttpStatus } from '@nestjs/common';
import { BaseService } from '../../common/services/base.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamService extends BaseService {
  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    super(logger);
  }

  async findAll(userId: string) {
    return this.executeDbOperation(
      () =>
        this.prisma.team.findMany({
          where: {
            memberships: {
              some: {
                userId,
              },
            },
          },
          include: {
            memberships: {
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
          },
        }),
      'Failed to retrieve teams',
      { userId },
    );
  }

  async createTeam(userId: string, data: any) {
    // Validate business rules
    this.validateBusinessRule(
      data.name && data.name.length <= 100,
      'Team name is required and cannot exceed 100 characters',
      'INVALID_TEAM_NAME',
      HttpStatus.BAD_REQUEST,
    );

    return this.executeDbOperation(
      () =>
        this.prisma.team.create({
          data: {
            name: data.name,
            memberships: {
              create: {
                userId,
                role: 'Admin',
              },
            },
          },
        }),
      'Failed to create team',
      { userId, teamData: data },
    );
  }

  async findById(teamId: string, userId: string) {
    const team = await this.executeDbOperation(
      () =>
        this.prisma.team.findUnique({
          where: { id: teamId },
          include: {
            memberships: {
              include: {
                user: true,
              },
            },
          },
        }),
      'Failed to retrieve team',
      { teamId, userId },
    );

    // Validate user has access to team
    this.validateBusinessRule(
      team !== null,
      'Team not found',
      'TEAM_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    // At this point we know team is not null
    const validTeam = team!;

    this.validateBusinessRule(
      validTeam.memberships.some((member) => member.userId === userId),
      'You do not have access to this team',
      'TEAM_ACCESS_DENIED',
      HttpStatus.FORBIDDEN,
    );

    return team;
  }
}
