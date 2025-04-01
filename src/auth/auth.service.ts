import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import * as bcrypt from 'bcryptjs';
import { SignupDto, LoginDto } from './dto';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../common/services/base.service';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class AuthService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private configService: ConfigService,
    logger: LoggerService,
  ) {
    super(logger);
    this.logger.setContext('AuthService');
  }

  async signUp(signupDto: SignupDto) {
    const { email, password, name } = signupDto;
    this.logger.log(`Processing signup request for ${email}`);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      this.logger.warn(`Signup attempt with existing email: ${email}`);
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          provider: 'LOCAL',
        },
      });
      this.logger.log(`User created successfully: ${user.id}`);

      const tokens = await this.generateTokens(user.id, user.email);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return { message: 'User registered successfully', tokens };
    } catch (error) {
      this.logger.error(
        `Error during user registration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async signIn(loginDto: LoginDto) {
    const { email, password } = loginDto;
    this.logger.log(`Processing signin request for ${email}`);

    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(`Login attempt with non-existent email: ${email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.provider !== 'LOCAL') {
        this.logger.warn(
          `Local login attempt for ${email} with ${user.provider} provider`,
        );
        throw new UnauthorizedException(
          'Please use Google to login with this account',
        );
      }

      // Add this check to handle null password case
      if (!user.password) {
        this.logger.warn(
          `Login attempt for account without password: ${email}`,
        );
        throw new UnauthorizedException(
          "This account doesn't have a password set",
        );
      }

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        this.logger.warn(
          `Failed login attempt - incorrect password for ${email}`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      const tokens = await this.generateTokens(user.id, user.email);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`User ${user.id} logged in successfully`);
      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Error during signin: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateTokens(userId: string, email: string) {
    this.logger.debug(`Generating tokens for user ${userId}`);
    const payload = { sub: userId, email };

    try {
      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.access.secret'),
        expiresIn: this.configService.get('jwt.access.expiresIn'),
      });

      const refreshToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refresh.secret'),
        expiresIn: this.configService.get('jwt.refresh.expiresIn'),
      });

      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error(
        `Error generating tokens: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async storeRefreshToken(userId: string, refreshToken: string) {
    this.logger.debug(`Storing refresh token for user ${userId}`);

    try {
      const hashedToken = await bcrypt.hash(refreshToken, 10);
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: hashedToken },
      });
      this.logger.debug(`Refresh token stored for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error storing refresh token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async refreshTokens(userId: string, refreshToken: string) {
    this.logger.log(`Processing token refresh for user ${userId}`);

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.refreshToken) {
        this.logger.warn(
          `Token refresh denied - user not found or no refresh token for ${userId}`,
        );
        throw new UnauthorizedException('Access Denied');
      }

      // At this point, TypeScript knows user.refreshToken is not null
      const refreshTokenMatches = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );
      if (!refreshTokenMatches) {
        this.logger.warn(
          `Token refresh denied - invalid refresh token for user ${userId}`,
        );
        throw new UnauthorizedException('Access Denied');
      }

      const tokens = await this.generateTokens(user.id, user.email);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Tokens refreshed successfully for user ${userId}`);
      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        `Error refreshing tokens: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async googleLogin(user) {
    this.logger.log(
      `Processing Google login for ${user?.email || 'unknown user'}`,
    );

    if (!user) {
      this.logger.error('Google login failed - no user data received');
      throw new Error('Google login failed');
    }

    try {
      let existingUser = await this.prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        this.logger.log(`Creating new user for Google login: ${user.email}`);
        existingUser = await this.prisma.user.create({
          data: {
            email: user.email,
            name: user.firstName + ' ' + user.lastName,
            provider: 'GOOGLE',
          },
        });
      } else {
        this.logger.log(`Existing user found for Google login: ${user.email}`);
      }

      const payload = { email: existingUser.email, sub: existingUser.id };
      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      });

      const refreshToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      });

      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const redirectUrl = `${frontendUrl}/auth/redirect?accessToken=${accessToken}&refreshToken=${refreshToken}`;

      this.logger.log(`Google login successful for user ${existingUser.id}`);
      return {
        redirectUrl,
        user: existingUser,
      };
    } catch (error) {
      this.logger.error(
        `Error during Google login: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async logout(userId: string) {
    this.logger.log(`Processing logout for user ${userId}`);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
      this.logger.log(`User ${userId} logged out successfully`);
    } catch (error) {
      this.logger.error(`Error during logout: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateUser(email: string, password: string) {
    // Find user by email
    const user = await this.executeDbOperation(
      () =>
        this.prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
          },
        }),
      'Failed to validate user credentials',
      { email },
    );

    // Check if user exists and is active
    this.validateBusinessRule(
      !!user,
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );

    // At this point, TypeScript knows user is not null
    const userData = user!;

    // Check if password exists
    this.validateBusinessRule(
      !!userData.password,
      'Password is not set for this account',
      'PASSWORD_NOT_SET',
      HttpStatus.UNAUTHORIZED,
    );

    // Compare passwords
    const isPasswordValid = await this.executeExternalServiceCall(
      () => bcrypt.compare(password, userData.password as string),
      'bcrypt',
      'comparing passwords',
      { userId: userData.id },
    );

    this.validateBusinessRule(
      isPasswordValid,
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );

    // Remove sensitive data
    const { password: _, ...result } = userData;
    return result;
  }

  async login(user: any) {
    // Generate JWT token
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to generate authentication token',
        error.stack,
        JSON.stringify({ userId: user.id }),
      );

      throw new BusinessException({
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async refreshToken(token: string) {
    try {
      // Verify the refresh token
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Get user from database to ensure they still exist and are active
      const user = await this.executeDbOperation(
        () =>
          this.prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
              id: true,
              email: true,
            },
          }),
        'Failed to validate refresh token',
        { userId: decoded.sub },
      );

      // Generate new tokens
      return this.login(user);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      this.logger.error(
        'Invalid refresh token',
        error.stack,
        JSON.stringify({ token: token?.substring(0, 10) + '...' }),
      );

      throw new BusinessException({
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        status: HttpStatus.UNAUTHORIZED,
      });
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    // Get user with password
    const user = await this.executeDbOperation(
      () =>
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, password: true },
        }),
      'Failed to retrieve user for password change',
      { userId },
    );

    // Check if user exists
    this.validateBusinessRule(
      !!user,
      'User not found',
      'USER_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    // At this point, TypeScript knows user is not null
    const userData = user!;

    // Check if password exists
    this.validateBusinessRule(
      !!userData.password,
      'Password is not set for this account',
      'PASSWORD_NOT_SET',
      HttpStatus.BAD_REQUEST,
    );

    // Verify current password
    const isPasswordValid = await this.executeExternalServiceCall(
      () => bcrypt.compare(currentPassword, userData.password as string),
      'bcrypt',
      'verifying current password',
      { userId },
    );

    this.validateBusinessRule(
      isPasswordValid,
      'Current password is incorrect',
      'INVALID_CURRENT_PASSWORD',
      HttpStatus.BAD_REQUEST,
    );

    // Hash the new password
    const hashedPassword = await this.executeExternalServiceCall(
      () => bcrypt.hash(newPassword, 10),
      'bcrypt',
      'hashing new password',
      { userId },
    );

    // Update password in database
    return this.executeDbOperation(
      () =>
        this.prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        }),
      'Failed to update password',
      { userId },
    );
  }
}
