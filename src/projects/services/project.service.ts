import { Injectable, HttpStatus } from '@nestjs/common';
import { BaseService } from '../../common/services/base.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectService extends BaseService {
  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    super(logger);
  }

  async findAll(userId: string) {
    return this.executeDbOperation(
      () =>
        this.prisma.project.findMany({
          where: {
            team: {
              memberships: {
                some: {
                  userId,
                },
              },
            },
          },
          include: {
            team: true,
          },
        }),
      'Failed to retrieve projects',
      { userId },
    );
  }

  async create(data: any, userId: string) {
    // Validate business rules
    this.validateBusinessRule(
      data.name && data.name.length <= 100,
      'Project name is required and cannot exceed 100 characters',
      'INVALID_PROJECT_NAME',
    );

    // Validate team access
    await this.validateTeamAccess(data.teamId, userId);

    return this.executeDbOperation(
      () =>
        this.prisma.project.create({
          data: {
            name: data.name,
            teamId: data.teamId,
          },
        }),
      'Failed to create project',
      { projectData: data, userId },
    );
  }

  async findById(projectId: string, userId: string) {
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
            tasks: true,
            workFlows: true,
          },
        }),
      'Failed to retrieve project',
      { projectId, userId },
    );

    this.validateBusinessRule(
      project !== null,
      'Project not found',
      'PROJECT_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    // By this point, we know project is not null due to the validation above
    // TypeScript needs a non-null assertion to understand this
    this.validateBusinessRule(
      project!.team.memberships.some((member) => member.userId === userId),
      'You do not have access to this project',
      'PROJECT_ACCESS_DENIED',
      HttpStatus.FORBIDDEN,
    );

    return project;
  }

  private async validateTeamAccess(teamId: string, userId: string) {
    const team = await this.executeDbOperation(
      () =>
        this.prisma.team.findFirst({
          where: {
            id: teamId,
            memberships: {
              some: {
                userId,
              },
            },
          },
        }),
      'Failed to validate team access',
      { teamId, userId },
    );

    this.validateBusinessRule(
      team !== null,
      'Team not found or you do not have access',
      'TEAM_ACCESS_DENIED',
      HttpStatus.FORBIDDEN,
    );
  }
}
