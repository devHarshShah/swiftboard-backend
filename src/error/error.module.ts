import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { DomainExceptionFilter } from '../common/filters/domain-exception.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { ErrorInterceptor } from '../common/interceptors/error.interceptor';
import { TimeoutInterceptor } from '../common/interceptors/timeout.interceptor';
import { ErrorHandlerProvider } from './error.service';
import { LoggerModule } from '../logger/logger.module';
import { LoggerService } from 'src/logger/logger.service';

@Module({
  imports: [
    LoggerModule, // Import LoggerModule here to make LoggerService available
  ],
  providers: [
    // Changed from Provider to Service pattern for clarity
    {
      provide: 'ErrorHandler',
      useClass: ErrorHandlerProvider,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: LoggerService) => {
        return new TimeoutInterceptor(logger, 60000);
      },
      inject: [LoggerService],
    },
  ],
  exports: ['ErrorHandler'],
})
export class ErrorModule {}
