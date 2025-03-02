import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async getUserById(userId: string) {
    console.log(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }
}
