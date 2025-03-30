import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('UsersService');
  }

  async createUser(createUserDto: CreateUserDto) {
    this.logger.log('Creating new user');
    this.logger.debug(
      `User creation data: ${JSON.stringify({
        ...createUserDto,
        password: '[REDACTED]', // Don't log sensitive information
      })}`,
    );

    const user = await this.prisma.user.create({
      data: createUserDto,
    });

    this.logger.log(`Successfully created user: ${user.name} (${user.id})`);
    return user;
  }

  async getAllUsers() {
    this.logger.log('Retrieving all users');

    const users = await this.prisma.user.findMany();

    this.logger.debug(`Retrieved ${users.length} users`);
    return users;
  }

  async getUserById(userId: string) {
    this.logger.log(`Retrieving user with ID: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User with ID ${userId} not found`);
      throw new NotFoundException('User not found');
    }

    this.logger.debug(`Found user: ${user.name} (${userId})`);
    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating user with ID: ${userId}`);

    // Don't log passwords
    const logSafeDto = { ...updateUserDto };
    if (logSafeDto.password) {
      logSafeDto.password = '[REDACTED]';
    }
    this.logger.debug(`Update data: ${JSON.stringify(logSafeDto)}`);

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateUserDto,
      });

      this.logger.log(
        `Successfully updated user: ${updatedUser.name} (${userId})`,
      );
      return updatedUser;
    } catch (error) {
      this.logger.error(
        `Error updating user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteUser(userId: string) {
    this.logger.log(`Deleting user with ID: ${userId}`);

    try {
      // Get user before deletion for logging purposes
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User with ID ${userId} not found for deletion`);
        throw new NotFoundException('User not found');
      }

      const deletedUser = await this.prisma.user.delete({
        where: { id: userId },
      });

      this.logger.log(
        `Successfully deleted user: ${deletedUser.name} (${userId})`,
      );
      return deletedUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error deleting user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
