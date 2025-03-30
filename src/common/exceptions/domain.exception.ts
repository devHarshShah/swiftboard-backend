import { HttpStatus } from '@nestjs/common';

export class DomainException extends Error {
  public readonly domain?: string;
  public readonly code?: string;
  private readonly status?: HttpStatus;
  public readonly details?: Record<string, any>;

  constructor(options: {
    message: string;
    domain?: string;
    code?: string;
    status?: HttpStatus;
    details?: Record<string, any>;
  }) {
    super(options.message);
    this.domain = options.domain;
    this.code = options.code;
    this.status = options.status || HttpStatus.BAD_REQUEST;
    this.details = options.details;

    // Ensures that the instance name is set properly for debugging
    Object.setPrototypeOf(this, DomainException.prototype);
  }

  getStatus(): HttpStatus {
    return this.status || HttpStatus.BAD_REQUEST;
  }
}
