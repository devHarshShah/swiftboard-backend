import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import * as bcrypt from 'bcryptjs';
import { SignupDto, LoginDto } from './dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
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
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      });

      const refreshToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
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
}
