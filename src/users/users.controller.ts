import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { GetUser } from './decorators/user.decorator';
import { AuthGuard } from '@nestjs/passport';
import {
  LongCache,
  UserCache,
  NoCache,
} from '../common/decorators/cache.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('users')
@ApiTags('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {}

  @Post()
  @NoCache()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async createUser(@Body() createUserDto: CreateUserDto) {
    const result = await this.usersService.createUser(createUserDto);

    // Invalidate users list cache
    await this.redisService.invalidateCachePattern(`*users:all*`);

    return result;
  }

  @Get()
  @LongCache({ ttl: 300, tags: ['users'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Returns all users' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('me')
  @UserCache(60) // Use the specific user decorator instead of the generic one
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Returns the current user' })
  async getCurrentUser(@GetUser() userId: string) {
    return this.usersService.getUserById(userId);
  }

  @Get(':id')
  @LongCache({
    ttl: 300,
    key: (request) => `user:${request.params.id}:viewer:${request.user?.sub}`,
    tags: ['user'],
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'Returns the requested user' })
  async getUserById(@Param('id') userId: string) {
    return this.usersService.getUserById(userId);
  }

  @Put(':id')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user details' })
  @ApiResponse({ status: 200, description: 'Returns the updated user' })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const result = await this.usersService.updateUser(userId, updateUserDto);

    // Invalidate user-specific caches
    await this.invalidateUserCaches(userId);

    return result;
  }

  @Delete(':id')
  @NoCache()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User successfully deleted' })
  async deleteUser(@Param('id') userId: string) {
    const result = await this.usersService.deleteUser(userId);

    // Invalidate user caches
    await this.invalidateUserCaches(userId);

    // Invalidate users list
    await this.redisService.invalidateCachePattern(`*users:all*`);

    return result;
  }

  // Helper method for user cache invalidation
  private async invalidateUserCaches(userId: string): Promise<void> {
    await this.redisService.invalidateCachePattern(`*user:${userId}*`);
    await this.redisService.invalidateCachePattern(`*user:me:${userId}*`);

    // Also invalidate team-related caches for this user
    await this.redisService.invalidateCachePattern(`*user:${userId}:teams*`);
  }
}
