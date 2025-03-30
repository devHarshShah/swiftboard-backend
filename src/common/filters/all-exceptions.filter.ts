import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { LoggerService } from '../../logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('AllExceptionsFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations like when testing, httpAdapter might not be available.
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    // Get request information
    const request = ctx.getRequest();
    const requestUrl = request.url;
    const requestMethod = request.method;

    // Handle HTTP exceptions
    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get the proper error message
    let errorMessage = 'Internal server error';
    let errorStack = '';

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      errorMessage =
        typeof response === 'string' ? response : JSON.stringify(response);
    } else if (exception instanceof Error) {
      errorMessage = exception.message;
      errorStack = exception.stack || '';
    }

    // Build response body
    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: requestUrl,
      message: errorMessage,
      error: httpStatus >= 500 ? 'Internal Server Error' : undefined,
    };

    // Log error with appropriate level based on status code
    if (httpStatus >= 500) {
      this.logger.error(
        `[${requestMethod}] ${requestUrl} ${httpStatus} - ${errorMessage}`,
        errorStack,
      );
    } else {
      this.logger.warn(
        `[${requestMethod}] ${requestUrl} ${httpStatus} - ${errorMessage}`,
      );
    }

    // Remove undefined fields from response
    Object.keys(responseBody).forEach(
      (key) => responseBody[key] === undefined && delete responseBody[key],
    );

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
