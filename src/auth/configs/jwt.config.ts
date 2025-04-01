import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  access: {
    secret: process.env.JWT_ACCESS_SECRET || 'super-strong-secret',
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET || 'super-strong-refresh-secret',
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  audience: process.env.JWT_AUDIENCE || 'https://swiftboard-api.onrender.com',
  issuer: process.env.JWT_ISSUER || 'swiftboard',
}));
