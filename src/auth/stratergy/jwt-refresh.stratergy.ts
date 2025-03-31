import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('jwt.refresh.secret'),
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  async validate(req, payload: any) {
    const refreshToken = req.get('Authorization')?.replace('Bearer ', '');
    if (!refreshToken) throw new UnauthorizedException('Refresh Token Missing');
    return { ...payload, refreshToken };
  }
}
