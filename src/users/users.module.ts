import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, LoggerService],
})
export class UsersModule {}
