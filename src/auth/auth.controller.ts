import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { LoginDto, SignupDto } from './dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guards';
import { Request, Response } from 'express';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'User Login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async signIn(@Body() loginDto: LoginDto) {
    return this.authService.signIn(loginDto);
  }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  @ApiOperation({ summary: 'User Signup' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async signUp(@Body() signupDto: SignupDto) {
    return this.authService.signUp(signupDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh Access Token' })
  @ApiResponse({ status: 200, description: 'New access token generated' })
  @UseGuards(JwtRefreshGuard)
  async refreshTokens(@Req() req) {
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Get('google')
  @ApiOperation({ summary: 'Google OAuth2 Authentication' })
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Redirects to Google for authentication
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth2 Callback' })
  @ApiResponse({ status: 200, description: 'Google authentication successful' })
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const { redirectUrl } = await this.authService.googleLogin(req.user);
    return res.redirect(redirectUrl);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'User Logout' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  async logout(@Req() req) {
    return this.authService.logout(req.user.sub);
  }
}
