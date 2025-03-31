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
import { Cache } from '../common/decorators/cache.decorator';

@Controller('users')
@ApiTags('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get()
  @Cache({ ttl: 300 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Returns all users' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('me')
  @Cache({ ttl: 60, key: (request) => `user:me:${request.user.sub}` })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Returns the current user' })
  async getCurrentUser(@GetUser() userId: string) {
    ////console.log('User ID:', userId); // Log the user ID to verify
    return this.usersService.getUserById(userId);
  }

  @Get(':id')
  @Cache({ ttl: 300, key: (request) => `user:${request.params.id}` })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'Returns the requested user' })
  async getUserById(@Param('id') userId: string) {
    return this.usersService.getUserById(userId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user details' })
  @ApiResponse({ status: 200, description: 'Returns the updated user' })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(userId, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User successfully deleted' })
  async deleteUser(@Param('id') userId: string) {
    return this.usersService.deleteUser(userId);
  }
}
