import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeamDto } from './dto/team.dto';
import { TeamRole } from '@prisma/client';
import { CustomMailerService } from 'src/custommailer/custommailer.service';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotificationGateway } from 'src/notification/notification-gateway';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: CustomMailerService,
    private configService: ConfigService,
    private notificationGateway: NotificationGateway,
    private logger: LoggerService,
  ) {
    this.logger.setContext('TeamsService');
  }

  async getAllTeams() {
    this.logger.log('Retrieving all teams');
    const teams = await this.prisma.team.findMany();
    this.logger.debug(`Retrieved ${teams.length} teams`);
    return teams;
  }

  async getTeamsByUserRole(userId: string, roles: TeamRole[]) {
    this.logger.log(
      `Retrieving teams for user ${userId} with roles: ${roles.join(', ')}`,
    );
    const teams = await this.prisma.team.findMany({
      where: {
        memberships: {
          some: {
            userId: userId,
            role: {
              in: roles,
            },
          },
        },
      },
    });
    this.logger.debug(`Retrieved ${teams.length} teams for user ${userId}`);
    return teams;
  }

  async getTeamById(teamId: string) {
    this.logger.log(`Retrieving team with ID: ${teamId}`);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) {
      this.logger.warn(`Team with ID ${teamId} not found`);
      throw new NotFoundException('Team not found');
    }
    this.logger.debug(`Found team: ${team.name} (${teamId})`);
    return team;
  }

  async createTeam(userId: string, createTeamDto: CreateTeamDto) {
    this.logger.log(
      `Creating new team: ${createTeamDto.name} by user ${userId}`,
    );
    const { name, emails } = createTeamDto;

    // Create the team
    const team = await this.prisma.team.create({
      data: {
        name,
      },
    });
    this.logger.debug(`Team created: ${team.name} (${team.id})`);

    await this.prisma.teamMembership.create({
      data: {
        teamId: team.id,
        userId: userId,
        role: 'Admin',
        status: 'active',
      },
    });
    this.logger.debug(
      `Created admin membership for user ${userId} in team ${team.id}`,
    );

    // Send invitations to the provided email addresses
    if (emails && emails.length > 0) {
      this.logger.debug(`Sending invitations to ${emails.length} recipients`);
      await this.sendTeamInvitations(team.id, emails);
    }

    await this.notificationGateway.emitNotification(userId, {
      message: `You have created a new team: ${team.name}`,
      userId: userId,
      type: 'TEAM_CREATION',
    });
    this.logger.debug(`Sent team creation notification to user ${userId}`);

    this.logger.log(`Successfully created team: ${team.name} (${team.id})`);
    return team;
  }

  private generateToken(): string {
    this.logger.debug('Generating invitation token');
    return randomBytes(32).toString('hex');
  }

  private getInvitationLink(token: string): string {
    const baseUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    this.logger.debug(`Creating invitation link with base URL: ${baseUrl}`);
    return `${baseUrl}/invitations/accept/${token}`;
  }

  async sendTeamInvitations(teamId: string, emails: string[]) {
    this.logger.log(
      `Sending invitations for team ${teamId} to ${emails.length} recipients`,
    );
    const team = await this.getTeamById(teamId);
    const now = new Date();

    // Set expiration to 7 days from now
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);
    this.logger.debug(`Invitation expiry set to: ${expiresAt.toISOString()}`);

    const results: { email: string; status: string; message: string }[] = [];

    for (const email of emails) {
      try {
        this.logger.debug(`Processing invitation for email: ${email}`);
        // Check if a user with this email already exists
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });

        let userId: string | null = null;
        if (existingUser) {
          userId = existingUser.id;
          this.logger.debug(`Found existing user ${userId} for email ${email}`);
        }

        // Check if an invitation already exists
        const existingMembership = await this.prisma.teamMembership.findFirst({
          where: {
            teamId,
            OR: [{ email }, { userId: userId ? userId : undefined }],
          },
        });

        if (existingMembership) {
          if (existingMembership.status === 'active') {
            this.logger.debug(
              `${email} is already a member of team ${teamId}, skipping invitation`,
            );
            results.push({
              email,
              status: 'skipped',
              message: 'User is already a member of this team',
            });
            continue;
          }

          if (
            existingMembership.status === 'pending' &&
            existingMembership.token
          ) {
            // Resend invitation with existing token
            const inviteLink = this.getInvitationLink(existingMembership.token);
            this.logger.debug(
              `Resending invitation to ${email} with existing token`,
            );

            // Update expiration date
            await this.prisma.teamMembership.update({
              where: { id: existingMembership.id },
              data: { expiresAt },
            });

            await this.mailService.sendTeamInvitationEmail(
              email,
              team.name,
              inviteLink,
              expiresAt,
            );
            this.logger.debug(`Resent invitation email to ${email}`);

            results.push({
              email,
              status: 'resent',
              message: 'Invitation resent',
            });
            continue;
          }
        }

        // Generate a unique token
        const token = this.generateToken();
        const inviteLink = this.getInvitationLink(token);
        this.logger.debug(`Generated new invitation token for ${email}`);

        if (userId) {
          await this.prisma.teamMembership.create({
            data: {
              teamId,
              userId: userId,
              email: userId ? undefined : email,
              status: 'pending',
              token,
              expiresAt,
              role: 'Viewer', // Default role
            },
          });
          this.logger.debug(
            `Created pending membership for existing user ${userId}`,
          );
        }

        // Send invitation email
        await this.mailService.sendTeamInvitationEmail(
          email,
          team.name,
          inviteLink,
          expiresAt,
        );
        this.logger.debug(`Sent invitation email to ${email}`);

        results.push({
          email,
          status: 'sent',
          message: 'Invitation sent',
        });
      } catch (error) {
        this.logger.error(
          `Error sending invitation to ${email}: ${error.message}`,
          error.stack,
        );
        results.push({
          email,
          status: 'error',
          message: error.message,
        });
      }
    }

    this.logger.debug(`Processing notifications for sent invitations`);
    for (const result of results) {
      if (result.status === 'sent') {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: result.email },
        });

        if (existingUser) {
          this.logger.debug(
            `Sending notification to existing user ${existingUser.id}`,
          );
          await this.notificationGateway.emitNotification(existingUser.id, {
            message: `You have been invited to join team: ${team.name}`,
            userId: existingUser.id,
            type: 'TEAM_INVITATION',
          });
        }
      }
    }

    this.logger.log(
      `Completed sending invitations: ${results.filter((r) => r.status === 'sent').length} sent, ${results.filter((r) => r.status === 'error').length} failed`,
    );
    return { results };
  }

  async processInvitation(token: string, userId: string) {
    this.logger.log(
      `Processing invitation token: ${token} for user: ${userId}`,
    );

    // Find the invitation
    const membership = await this.prisma.teamMembership.findUnique({
      where: { token },
      include: { team: true, user: true },
    });

    if (!membership) {
      this.logger.warn(`Invitation with token ${token} not found`);
      throw new NotFoundException('Invitation not found');
    }

    this.logger.debug(
      `Found invitation for team: ${membership.team.name} (${membership.teamId})`,
    );

    if (membership.status !== 'pending') {
      this.logger.warn(
        `Invitation with token ${token} has already been processed (status: ${membership.status})`,
      );
      throw new BadRequestException(
        'This invitation has already been processed',
      );
    }

    if (!membership.expiresAt || membership.expiresAt < new Date()) {
      this.logger.warn(`Invitation with token ${token} has expired`);
      throw new BadRequestException('This invitation has expired');
    }

    // Get user by ID
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(
        `User with ID ${userId} not found when processing invitation`,
      );
      throw new NotFoundException('User not found');
    }

    // Check if invitation matches user's email
    if (
      membership.email &&
      membership.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      this.logger.warn(
        `Email mismatch: invitation for ${membership.email}, but user is ${user.email}`,
      );
      throw new BadRequestException(
        'This invitation was sent to a different email address',
      );
    }

    // If userId is not set on the membership, but there's a matching email
    if (!membership.userId && membership.email === user.email) {
      this.logger.debug(
        `Updating membership with user ID for email match: ${user.email}`,
      );
      // Update the membership with the user's ID and status
      await this.prisma.teamMembership.update({
        where: { id: membership.id },
        data: {
          userId: user.id,
          email: null, // Clear email since we have a user ID now
          status: 'active',
          token: null, // Clear the token as it's been used
          expiresAt: null, // Clear expiration
        },
      });
    } else if (membership.userId === user.id) {
      this.logger.debug(
        `Updating membership status for matching user ID: ${user.id}`,
      );
      // Update the membership status for the matching user ID
      await this.prisma.teamMembership.update({
        where: { id: membership.id },
        data: {
          status: 'active',
          token: null, // Clear the token
          expiresAt: null, // Clear expiration
        },
      });
    } else {
      this.logger.warn(
        `User ${userId} tried to accept invitation for a different account`,
      );
      throw new BadRequestException(
        'This invitation was not sent to your account',
      );
    }

    this.logger.debug(`Sending join team notification to user ${userId}`);
    await this.notificationGateway.emitNotification(userId, {
      message: `You have joined the team: ${membership.team.name}`,
      userId: userId,
      type: 'TEAM_JOIN',
    });

    // Notify team admin
    const teamAdmin = await this.prisma.teamMembership.findFirst({
      where: { teamId: membership.team.id, role: 'Admin' },
    });

    if (teamAdmin) {
      this.logger.debug(
        `Sending notification to team admin ${teamAdmin.userId}`,
      );
      await this.notificationGateway.emitNotification(teamAdmin.userId, {
        message: `${user.email} has joined your team: ${membership.team.name}`,
        userId: teamAdmin.userId,
        type: 'TEAM_MEMBER_JOIN',
      });
    }

    this.logger.log(
      `User ${userId} successfully joined team ${membership.team.name} (${membership.teamId})`,
    );
    return {
      message: 'You have joined the team',
      team: membership.team,
    };
  }

  async declineInvitation(token: string) {
    this.logger.log(`Declining invitation with token: ${token}`);

    const membership = await this.prisma.teamMembership.findUnique({
      where: { token },
      include: { team: true },
    });

    if (!membership) {
      this.logger.warn(`Invitation with token ${token} not found`);
      throw new NotFoundException('Invitation not found');
    }

    this.logger.debug(
      `Found invitation for team: ${membership.team.name} (${membership.teamId})`,
    );

    if (membership.status !== 'pending') {
      this.logger.warn(
        `Invitation with token ${token} has already been processed (status: ${membership.status})`,
      );
      throw new BadRequestException(
        'This invitation has already been processed',
      );
    }

    // Update membership status
    await this.prisma.teamMembership.update({
      where: { id: membership.id },
      data: {
        status: 'declined',
        token: null, // Clear the token
        expiresAt: null, // Clear expiration
      },
    });
    this.logger.debug(`Updated invitation status to declined`);

    const teamAdmin = await this.prisma.teamMembership.findFirst({
      where: { teamId: membership.teamId, role: 'Admin' },
    });

    if (teamAdmin) {
      this.logger.debug(
        `Sending notification to team admin ${teamAdmin.userId}`,
      );
      await this.notificationGateway.emitNotification(teamAdmin.userId, {
        message: `An invitation to join ${membership.team.name} has been declined`,
        userId: teamAdmin.userId,
        type: 'TEAM_INVITATION_DECLINED',
      });
    }

    this.logger.log(
      `Invitation for team ${membership.teamId} successfully declined`,
    );
    return { message: 'Invitation declined' };
  }

  async getTeamInvitations(teamId: string) {
    this.logger.log(`Retrieving pending invitations for team: ${teamId}`);

    await this.getTeamById(teamId); // Ensure team exists

    const invitations = await this.prisma.teamMembership.findMany({
      where: {
        teamId,
        status: 'pending',
        token: { not: null }, // Only get records with tokens (invitations)
      },
      include: {
        user: true, // Include user info if available
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.debug(
      `Retrieved ${invitations.length} pending invitations for team ${teamId}`,
    );
    return invitations;
  }

  async getInvitationByToken(token: string) {
    this.logger.log(`Looking up invitation by token: ${token}`);

    const membership = await this.prisma.teamMembership.findUnique({
      where: { token },
      include: { team: true, user: true },
    });

    if (!membership) {
      this.logger.warn(`Invitation with token ${token} not found`);
      throw new NotFoundException('Invitation not found');
    }

    this.logger.debug(
      `Found invitation for team: ${membership.team?.name || 'unknown'} (${membership.teamId})`,
    );
    return membership;
  }

  async resendInvitation(membershipId: string) {
    this.logger.log(`Resending invitation for membership ID: ${membershipId}`);

    const membership = await this.prisma.teamMembership.findUnique({
      where: { id: membershipId },
      include: { team: true },
    });

    if (!membership) {
      this.logger.warn(`Membership with ID ${membershipId} not found`);
      throw new NotFoundException('Invitation not found');
    }

    this.logger.debug(
      `Found membership for team: ${membership.team.name} (${membership.teamId})`,
    );

    if (membership.status !== 'pending' || !membership.token) {
      this.logger.warn(
        `Cannot resend invitation, status: ${membership.status}, has token: ${!!membership.token}`,
      );
      throw new BadRequestException('Cannot resend this invitation');
    }

    // Get email to send to (either from membership or from associated user)
    let emailToUse: string;

    if (membership.email) {
      emailToUse = membership.email;
      this.logger.debug(`Using email from membership: ${emailToUse}`);
    } else if (membership.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: membership.userId },
      });
      if (!user) {
        this.logger.warn(`User with ID ${membership.userId} not found`);
        throw new NotFoundException('User not found');
      }
      emailToUse = user.email;
      this.logger.debug(`Using email from user record: ${emailToUse}`);
    } else {
      this.logger.warn(`No email available for membership ${membershipId}`);
      throw new BadRequestException('No email available for this invitation');
    }

    // Update expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.teamMembership.update({
      where: { id: membership.id },
      data: { expiresAt },
    });

    this.logger.debug(`Updated expiration date to ${expiresAt.toISOString()}`);

    // Resend email
    const inviteLink = this.getInvitationLink(membership.token);

    await this.mailService.sendTeamInvitationEmail(
      emailToUse,
      membership.team.name,
      inviteLink,
      expiresAt,
    );

    this.logger.log(`Successfully resent invitation to ${emailToUse}`);
    return { message: 'Invitation resent' };
  }

  async cancelInvitation(membershipId: string) {
    this.logger.log(
      `Cancelling invitation with membership ID: ${membershipId}`,
    );

    const membership = await this.prisma.teamMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      this.logger.warn(`Membership with ID ${membershipId} not found`);
      throw new NotFoundException('Invitation not found');
    }

    if (membership.status !== 'pending') {
      this.logger.warn(
        `Cannot cancel invitation with status: ${membership.status}`,
      );
      throw new BadRequestException(
        'This invitation has already been processed',
      );
    }

    this.logger.debug(`Deleting invitation for team ${membership.teamId}`);

    // Delete the membership record
    await this.prisma.teamMembership.delete({
      where: { id: membership.id },
    });

    this.logger.log(`Successfully cancelled invitation ${membershipId}`);
    return { message: 'Invitation cancelled' };
  }

  // Existing methods with slight modifications

  async updateTeam(teamId: string, updateTeamDto) {
    this.logger.log(`Updating team with ID: ${teamId}`);
    this.logger.debug(`Update data: ${JSON.stringify(updateTeamDto)}`);

    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: updateTeamDto,
    });

    if (!team) {
      this.logger.warn(`Team with ID ${teamId} not found or update failed`);
      throw new NotFoundException('Team not found or update failed');
    }

    this.logger.log(`Successfully updated team: ${team.name} (${teamId})`);
    return team;
  }

  async deleteTeam(teamId: string) {
    this.logger.log(`Deleting team with ID: ${teamId}`);

    await this.getTeamById(teamId); // Ensure the team exists
    await this.prisma.team.delete({ where: { id: teamId } });

    this.logger.log(`Successfully deleted team ${teamId}`);
    return { message: 'Team successfully deleted' };
  }

  // This method now just updates status to active (for admin forced activation)
  async addMemberToTeam(teamId: string, membershipId: string) {
    this.logger.log(`Activating membership ${membershipId} in team ${teamId}`);

    const membership = await this.prisma.teamMembership.update({
      where: { id: membershipId },
      data: {
        status: 'active',
        token: null,
        expiresAt: null,
      },
    });

    this.logger.debug(
      `Activated membership for user ${membership.userId} in team ${teamId}`,
    );
    this.logger.log(`Successfully activated membership ${membershipId}`);
    return membership;
  }
  async removeMemberFromTeam(teamId: string, membershipId: string) {
    this.logger.log(
      `Removing member with membership ID ${membershipId} from team ${teamId}`,
    );

    const membership = await this.prisma.teamMembership.findUnique({
      where: { id: membershipId },
      include: { user: true, team: true },
    });

    if (!membership) {
      this.logger.warn(`Membership ${membershipId} not found`);
      throw new NotFoundException('Team membership not found');
    }

    this.logger.debug(
      `Found membership for user ${membership.userId} in team ${teamId}`,
    );

    await this.prisma.teamMembership.delete({
      where: { id: membershipId },
    });

    this.logger.debug(`Deleted membership record ${membershipId}`);

    if (membership) {
      // Notify removed member
      this.logger.debug(
        `Sending notification to removed user ${membership.userId}`,
      );
      await this.notificationGateway.emitNotification(membership.userId, {
        message: `You have been removed from team: ${membership.team.name}`,
        userId: membership.userId,
        type: 'TEAM_REMOVAL',
      });

      // Notify team admin
      const teamAdmin = await this.prisma.teamMembership.findFirst({
        where: { teamId, role: 'Admin' },
      });

      if (teamAdmin) {
        this.logger.debug(
          `Sending notification to team admin ${teamAdmin.userId}`,
        );
        await this.notificationGateway.emitNotification(teamAdmin.userId, {
          message: `${membership.user.email} has been removed from team: ${membership.team.name}`,
          userId: teamAdmin.userId,
          type: 'TEAM_MEMBER_REMOVAL',
        });
      }
    }

    this.logger.log(`Successfully removed member from team ${teamId}`);
    return { message: 'Member removed from team' };
  }

  async getTeamMembers(teamId: string) {
    this.logger.log(`Retrieving members for team: ${teamId}`);

    const team = await this.getTeamById(teamId);
    const members = await this.prisma.teamMembership.findMany({
      where: {
        teamId: team.id,
        status: 'active', // Only get active members
      },
      include: { user: true },
    });

    this.logger.debug(
      `Retrieved ${members.length} active members for team ${teamId}`,
    );
    return members;
  }

  async getTeamProjects(teamId: string) {
    this.logger.log(`Retrieving projects for team: ${teamId}`);

    const team = await this.getTeamById(teamId);
    const teamWithProjects = await this.prisma.team.findUnique({
      where: { id: team.id },
      include: { projects: true },
    });

    this.logger.debug(
      `Retrieved ${teamWithProjects?.projects?.length || 0} projects for team ${teamId}`,
    );
    return teamWithProjects;
  }

  async getTeamTasks(teamId: string) {
    this.logger.log(`Retrieving tasks for team: ${teamId}`);

    const team = await this.getTeamById(teamId);
    const fullTeam = await this.prisma.team.findUnique({
      where: { id: team.id },
      include: { projects: { include: { tasks: true } } },
    });

    if (!fullTeam || !fullTeam.projects) {
      this.logger.debug(`No projects or tasks found for team ${teamId}`);
      return [];
    }

    const tasks = fullTeam.projects.flatMap((project) => project.tasks);
    this.logger.debug(
      `Retrieved ${tasks.length} tasks across ${fullTeam.projects.length} projects for team ${teamId}`,
    );
    return tasks;
  }

  async getUserTeams(userId: string) {
    this.logger.log(`Retrieving teams for user: ${userId}`);

    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId },
      include: { team: true },
    });

    this.logger.debug(`User ${userId} belongs to ${memberships.length} teams`);
    return memberships;
  }
}
