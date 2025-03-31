import { Injectable, HttpStatus } from '@nestjs/common';
import { BaseService } from '../../common/services/base.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService extends BaseService {
  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    super(logger);
  }

  async findById(userId: string) {
    const user = await this.executeDbOperation(
      () =>
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      'Failed to retrieve user',
      { userId },
    );

    this.validateBusinessRule(
      user !== null,
      'User not found',
      'USER_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    return user;
  }

  async updateProfile(userId: string, data: any) {
    // Validate business rules
    if (data.name) {
      this.validateBusinessRule(
        data.name.length >= 2 && data.name.length <= 100,
        'Name must be between 2 and 100 characters',
        'INVALID_NAME',
      );
    }

    return this.executeDbOperation(
      () =>
        this.prisma.user.update({
          where: { id: userId },
          data: {
            name: data.name,
          },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      'Failed to update user profile',
      { userId, userData: data },
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    // Get user with current password
    const user = await this.executeDbOperation(
      () =>
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            password: true,
          },
        }),
      'Failed to retrieve user for password change',
      { userId },
    );

    // In a real implementation, verify the current password
    // This is just a placeholder
    const isPasswordValid = true; // Replace with actual validation

    this.validateBusinessRule(
      isPasswordValid,
      'Current password is incorrect',
      'INVALID_PASSWORD',
      HttpStatus.UNAUTHORIZED,
    );

    this.validateBusinessRule(
      !!newPassword && newPassword.length >= 8,
      'New password must be at least 8 characters long',
      'INVALID_NEW_PASSWORD',
    );

    // In real implementation, hash the password before saving
    return this.executeDbOperation(
      () =>
        this.prisma.user.update({
          where: { id: userId },
          data: {
            password: newPassword, // In reality, this should be hashed
          },
          select: {
            id: true,
          },
        }),
      'Failed to change password',
      { userId },
    );
  }
}
