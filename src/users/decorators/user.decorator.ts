import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export const GetUser = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // If AuthGuard is working properly, the user should already be attached to the request
    if (request.user && request.user.id) {
      return request.user.id;
    }

    // Fallback to manual token extraction
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header');
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('No token found');
      return null;
    }

    try {
      const jwtService = new JwtService({
        secret: process.env.JWT_ACCESS_SECRET,
      });

      const decodedToken = await jwtService.verifyAsync(token);
      console.log('Decoded token:', decodedToken);
      return decodedToken.sub; // Make sure your token payload uses 'sub' for the user ID
    } catch (error) {
      console.log('Token verification failed:', error);
      return null;
    }
  },
);
