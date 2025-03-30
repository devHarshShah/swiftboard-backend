import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class BusinessException extends DomainException {
  constructor(options: {
    message: string;
    code?: string;
    status?: HttpStatus;
    details?: Record<string, any>;
  }) {
    super({
      ...options,
      domain: 'business',
    });

    // Ensures that the instance name is set properly for debugging
    Object.setPrototypeOf(this, BusinessException.prototype);
  }
}
