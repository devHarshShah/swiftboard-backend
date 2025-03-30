import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../../logger/logger.service';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Add error details from exception response
    if (typeof exceptionResponse === 'object') {
      const exceptionResponseObj = exceptionResponse as Record<string, any>;

      if (exceptionResponseObj.message) {
        errorResponse['message'] = Array.isArray(exceptionResponseObj.message)
          ? exceptionResponseObj.message
          : [exceptionResponseObj.message];
      }

      if (exceptionResponseObj.error) {
        errorResponse['error'] = exceptionResponseObj.error;
      }
    } else {
      // If exceptionResponse is just a string
      errorResponse['message'] = [exceptionResponse];
    }

    // Log the error
    this.logger.warn(
      `[${request.method}] ${request.url} ${status} - ${JSON.stringify(errorResponse['message'])}`,
    );

    response.status(status).json(errorResponse);
  }
}
