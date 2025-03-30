import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class ErrorHandlerProvider {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('ErrorHandler');
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: Error) => {
      this.logger.error(
        'Unhandled Promise Rejection:',
        reason?.stack || String(reason),
      );
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception:', error?.stack || String(error));

      // For uncaught exceptions, it's often safest to exit and let the process manager restart
      // In a production environment, you might want to delay the exit to allow for logging
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle when the process is about to exit
    process.on('exit', (code) => {
      this.logger.log(`Process is about to exit with code: ${code}`);
    });

    // Handle SIGTERM signal
    process.on('SIGTERM', () => {
      this.logger.log('SIGTERM received. Graceful shutdown initiated.');
      // Here you could implement graceful shutdown logic
      process.exit(0);
    });
  }
}
