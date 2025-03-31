import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DatabaseSecurityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sanitizes a string input that might be used in a dynamic database operation
   * Note: Prisma handles parameterized queries automatically, but this is an extra layer of protection
   */
  sanitizeInput(input: string): string {
    if (!input) return input;

    // Remove dangerous SQL characters
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment start
      .replace(/\*\//g, ''); // Remove block comment end
  }

  /**
   * Safe pagination helper that prevents parameter tampering
   */
  getPaginationParams(
    page = 1,
    limit = 10,
    maxLimit = 100,
  ): { skip: number; take: number } {
    // Ensure page and limit are positive numbers
    const validatedPage = Math.max(1, Number(page));
    const validatedLimit = Math.min(Math.max(1, Number(limit)), maxLimit);

    return {
      skip: (validatedPage - 1) * validatedLimit,
      take: validatedLimit,
    };
  }

  /**
   * Safe ordering helper that prevents parameter tampering
   */
  getOrderParams(
    orderBy: string,
    direction: 'asc' | 'desc' = 'asc',
    allowedFields: string[] = [],
  ): any {
    // Check if the field is allowed
    if (!orderBy || !allowedFields.includes(orderBy)) {
      return {}; // Default ordering or no ordering
    }

    // Validate direction
    const validDirection = direction === 'desc' ? 'desc' : 'asc';

    // Return Prisma-compatible order object
    return {
      orderBy: {
        [orderBy]: validDirection,
      },
    };
  }
}
