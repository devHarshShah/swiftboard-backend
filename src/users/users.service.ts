import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseService } from '../common/services/base.service';
import { LoggerService } from '../logger/logger.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    super(logger);
    this.logger.setContext('UsersService');
  }

  async getAllUsers(page = 1, limit = 10) {
    return this.executeDbOperation(
      () =>
        this.prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
        }),
      'Failed to retrieve users',
      { page, limit },
    );
  }

  async getUserById(id: string) {
    const user = await this.executeDbOperation(
      () => this.prisma.user.findUnique({ where: { id } }),
      'Failed to retrieve user',
      { userId: id },
    );

    this.validateBusinessRule(
      !!user,
      'User not found',
      'USER_NOT_FOUND',
      HttpStatus.NOT_FOUND,
      { userId: id },
    );

    return user;
  }

  async createUser(createUserDto: CreateUserDto) {
    // Validate business rules before attempting to create
    await this.validateUserData(createUserDto);

    return this.executeDbOperation(
      () => this.prisma.user.create({ data: createUserDto }),
      'Failed to create user',
      { userData: createUserDto },
    );
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    await this.getUserById(id);

    // Validate update data if needed
    if (updateUserDto.email) {
      await this.validateEmailAvailability(updateUserDto.email, id);
    }

    return this.executeDbOperation(
      () =>
        this.prisma.user.update({
          where: { id },
          data: updateUserDto,
        }),
      'Failed to update user',
      { userId: id, updateData: updateUserDto },
    );
  }

  async deleteUser(id: string) {
    // Check if user exists
    await this.getUserById(id);

    return this.executeDbOperation(
      () => this.prisma.user.delete({ where: { id } }),
      'Failed to delete user',
      { userId: id },
    );
  }

  private async validateUserData(userData: CreateUserDto) {
    // Example validation: Check if email already exists
    await this.validateEmailAvailability(userData.email);

    // Add more business rule validations as needed
  }

  private async validateEmailAvailability(
    email: string,
    excludeUserId?: string,
  ) {
    const existingUser = await this.executeDbOperation(
      () =>
        this.prisma.user.findFirst({
          where: {
            email,
            ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
          },
        }),
      'Failed to validate email availability',
      { email, excludeUserId },
    );

    this.validateBusinessRule(
      !existingUser,
      'Email already in use',
      'EMAIL_ALREADY_EXISTS',
      HttpStatus.CONFLICT,
      { email },
    );
  }
}
