import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeamDto } from './dto/team.dto';
import { CustomMailerService } from 'src/custommailer/custommailer.service';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: CustomMailerService,
    private configService: ConfigService,
  ) {}

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

  async createTeam(createTeamDto: CreateTeamDto) {
    const { name, emails } = createTeamDto;

    // Create the team
    const team = await this.prisma.team.create({
      data: {
        name,
      },
    });

    // Send invitations to the provided email addresses
    if (emails && emails.length > 0) {
      await this.sendTeamInvitations(team.id, emails);
    }

    return team;
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getInvitationLink(token: string): string {
    const baseUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    return `${baseUrl}/invitations/accept/${token}`;
  }

  async sendTeamInvitations(teamId: string, emails: string[]) {
    const team = await this.getTeamById(teamId);
    const now = new Date();

    // Set expiration to 7 days from now
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const results: { email: string; status: string; message: string }[] = [];

    for (const email of emails) {
      try {
        // Check if a user with this email already exists
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });

        let userId: string | null = null;
        if (existingUser) {
          userId = existingUser.id;
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
        }

        // Send invitation email
        await this.mailService.sendTeamInvitationEmail(
          email,
          team.name,
          inviteLink,
          expiresAt,
        );

        results.push({
          email,
          status: 'sent',
          message: 'Invitation sent',
        });
      } catch (error) {
        results.push({
          email,
          status: 'error',
          message: error.message,
        });
      }
    }

    return { results };
  }

  async processInvitation(token: string, userId: string) {
    // Find the invitation
    const membership = await this.prisma.teamMembership.findUnique({
      where: { token },
      include: { team: true, user: true },
    });

    if (!membership) {
      throw new NotFoundException('Invitation not found');
    }

    if (membership.status !== 'pending') {
      throw new BadRequestException(
        'This invitation has already been processed',
      );
    }

    if (!membership.expiresAt || membership.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }

    // Get user by ID
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if invitation matches user's email
    if (
      membership.email &&
      membership.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new BadRequestException(
        'This invitation was sent to a different email address',
      );
    }

    // If userId is not set on the membership, but there's a matching email
    if (!membership.userId && membership.email === user.email) {
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
      throw new BadRequestException(
        'This invitation was not sent to your account',
      );
    }

    return {
      message: 'You have joined the team',
      team: membership.team,
    };
  }

  async declineInvitation(token: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { token },
    });

    if (!membership) {
      throw new NotFoundException('Invitation not found');
    }

    if (membership.status !== 'pending') {
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

    return { message: 'Invitation declined' };
  }

  async getTeamInvitations(teamId: string) {
    await this.getTeamById(teamId); // Ensure team exists

    return this.prisma.teamMembership.findMany({
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
  }

  async getInvitationByToken(token: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { token },
      include: { team: true, user: true },
    });

    if (!membership) {
      throw new NotFoundException('Invitation not found');
    }

    return membership;
  }

  async resendInvitation(membershipId: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { id: membershipId },
      include: { team: true },
    });

    if (!membership) {
      throw new NotFoundException('Invitation not found');
    }

    if (membership.status !== 'pending' || !membership.token) {
      throw new BadRequestException('Cannot resend this invitation');
    }

    // Get email to send to (either from membership or from associated user)
    let emailToUse: string;

    if (membership.email) {
      emailToUse = membership.email;
    } else if (membership.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: membership.userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      emailToUse = user.email;
    } else {
      throw new BadRequestException('No email available for this invitation');
    }

    // Update expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.teamMembership.update({
      where: { id: membership.id },
      data: { expiresAt },
    });

    // Resend email
    const inviteLink = this.getInvitationLink(membership.token);

    await this.mailService.sendTeamInvitationEmail(
      emailToUse,
      membership.team.name,
      inviteLink,
      expiresAt,
    );

    return { message: 'Invitation resent' };
  }

  async cancelInvitation(membershipId: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Invitation not found');
    }

    if (membership.status !== 'pending') {
      throw new BadRequestException(
        'This invitation has already been processed',
      );
    }

    // Delete the membership record
    await this.prisma.teamMembership.delete({
      where: { id: membership.id },
    });

    return { message: 'Invitation cancelled' };
  }

  // Existing methods with slight modifications

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

  // This method now just updates status to active (for admin forced activation)
  async addMemberToTeam(teamId: string, membershipId: string) {
    const membership = await this.prisma.teamMembership.update({
      where: { id: membershipId },
      data: {
        status: 'active',
        token: null,
        expiresAt: null,
      },
    });

    return membership;
  }

  async removeMemberFromTeam(teamId: string, membershipId: string) {
    await this.prisma.teamMembership.delete({
      where: { id: membershipId },
    });

    return { message: 'Member removed from team' };
  }

  async getTeamMembers(teamId: string) {
    const team = await this.getTeamById(teamId);
    return await this.prisma.teamMembership.findMany({
      where: {
        teamId: team.id,
        status: 'active', // Only get active members
      },
      include: { user: true },
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

  async getUserTeams(userId: string) {
    return this.prisma.teamMembership.findMany({
      where: { userId },
      include: { team: true },
    });
  }
}
