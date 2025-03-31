import { Injectable, HttpStatus } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import { BaseService } from './base.service';
import { BusinessException } from '../exceptions/business.exception';

@Injectable()
export class ExternalApiService extends BaseService {
  constructor(
    logger: LoggerService,
    private readonly httpService: any, // Replace with actual HTTP service
  ) {
    super(logger);
    this.logger.setContext('ExternalApiService');
  }

  /**
   * Make a GET request to an external API with proper error handling
   */
  async get<T>(url: string, serviceName: string, options?: any): Promise<T> {
    return this.executeExternalServiceCall(
      async () => {
        const response = await this.httpService.get(url, options);
        return response.data;
      },
      serviceName,
      `fetching data from ${url}`,
      { url, options },
    );
  }

  /**
   * Make a POST request to an external API with proper error handling
   */
  async post<T>(
    url: string,
    data: any,
    serviceName: string,
    options?: any,
  ): Promise<T> {
    return this.executeExternalServiceCall(
      async () => {
        const response = await this.httpService.post(url, data, options);
        return response.data;
      },
      serviceName,
      `sending data to ${url}`,
      { url, data, options },
    );
  }

  /**
   * Helper method for handling API response errors
   */
  handleApiError(error: any, serviceName: string, operation: string) {
    // Log the error
    this.logger.error(
      `API Error in ${serviceName} during ${operation}: ${error?.response?.data || error.message}`,
      error.stack,
      JSON.stringify({
        status: error?.response?.status,
        message: error?.response?.data || error.message,
      }),
    );

    // Handle specific HTTP status codes
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        throw new BusinessException({
          message: 'Resource not found in external service',
          code: 'EXTERNAL_RESOURCE_NOT_FOUND',
          status: HttpStatus.NOT_FOUND,
        });
      }

      if (status === 401 || status === 403) {
        throw new BusinessException({
          message: 'Authentication failed with external service',
          code: 'EXTERNAL_AUTH_ERROR',
          status: HttpStatus.BAD_GATEWAY,
        });
      }

      if (status >= 500) {
        throw new BusinessException({
          message: `${serviceName} is currently unavailable`,
          code: 'EXTERNAL_SERVICE_ERROR',
          status: HttpStatus.BAD_GATEWAY,
        });
      }
    }

    // Network or other errors
    throw new BusinessException({
      message: `Error communicating with ${serviceName}`,
      code: 'EXTERNAL_SERVICE_ERROR',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
