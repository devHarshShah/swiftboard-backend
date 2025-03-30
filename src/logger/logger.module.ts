import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { LoggerService } from './logger.service';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';

        // Define log format
        const logFormat = winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          winston.format.json(),
        );

        // Define console transport format
        const consoleFormat = winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(
            ({ timestamp, level, message, context, trace }) => {
              return `${timestamp} [${context || 'Application'}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
            },
          ),
        );

        // Define transports
        const transports: winston.transport[] = [
          // Console transport
          new winston.transports.Console({
            format: consoleFormat,
            level: isProduction ? 'info' : 'debug',
          }),
        ];

        // Add file transports in production
        if (isProduction) {
          // Create a transport for info logs
          const infoLogTransport = new DailyRotateFile({
            filename: 'logs/info-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'info',
            maxSize: '20m',
            maxFiles: '14d',
            format: logFormat,
          });

          // Create a transport for error logs
          const errorLogTransport = new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d',
            format: logFormat,
          });

          transports.push(infoLogTransport, errorLogTransport);
        }

        return {
          transports,
          // Catch uncaught exceptions
          exceptionHandlers: [
            new winston.transports.File({ filename: 'logs/exceptions.log' }),
          ],
          // Catch unhandled promise rejections
          rejectionHandlers: [
            new winston.transports.File({ filename: 'logs/rejections.log' }),
          ],
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
