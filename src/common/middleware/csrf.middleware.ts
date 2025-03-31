import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as csrf from 'csurf';

// Extend Express Request interface to include csrfToken method
declare global {
  namespace Express {
    interface Request {
      csrfToken(): string;
    }
  }
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection: any;
  private isEnabled: boolean;

  constructor() {
    // Check if CSRF should be disabled in development
    this.isEnabled = process.env.DISABLE_CSRF !== 'true';

    // Initialize CSRF protection
    this.csrfProtection = csrf({
      cookie: {
        key: '_csrf', // Cookie name
        httpOnly: true, // Can't be accessed by JavaScript
        sameSite: 'strict', // Restrict cookie to same site
        secure: process.env.NODE_ENV === 'production', // Only over HTTPS in production
      },
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'], // These methods don't modify state
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF if it's disabled (for development)
    if (!this.isEnabled) {
      return next();
    }

    // Define paths that should be exempt from CSRF protection
    const exemptPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
    ];

    // Skip CSRF for API endpoints using bearer token or exempt paths
    if (
      req.path.startsWith('/') &&
      (req.headers.authorization?.startsWith('Bearer ') ||
        exemptPaths.some((path) => req.path.includes(path)))
    ) {
      return next();
    }

    // Apply CSRF protection
    this.csrfProtection(req, res, (err: any) => {
      if (err) {
        // Log the CSRF error with more details
        console.error('CSRF Error:', {
          message: err.message || err,
          path: req.path,
          method: req.method,
          headers: req.headers['csrf-token']
            ? 'CSRF token present'
            : 'No CSRF token',
        });

        // Send appropriate error response
        return res.status(403).json({
          statusCode: 403,
          message: 'Invalid CSRF token',
          error: 'Forbidden',
        });
      }

      // If no error, add CSRF token to res.locals for access in templates
      res.locals.csrfToken = req.csrfToken();
      next();
    });
  }
}
