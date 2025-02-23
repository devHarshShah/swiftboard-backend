import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './stratergy/jwt.stratergy';
import { JwtRefreshStrategy } from './stratergy/jwt-refresh.stratergy';
import { GoogleStrategy } from './stratergy/google.stratergy';

@Module({
  imports: [JwtModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, GoogleStrategy],
})
export class AuthModule {}
