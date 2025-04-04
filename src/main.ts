import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import { LoggerService as Logger } from './logger/logger.service';
import { RequestMethod } from '@nestjs/common';

async function bootstrap() {
  // Create NestJS app first to access the logger provider
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until custom logger is set up
  });

  // Get the logger from the app's dependency injection container
  const logger = app.get(Logger);
  logger.setContext('Bootstrap');

  try {
    // Get config service
    const configService = app.get(ConfigService);

    // Apply security headers with helmet
    app.use(helmet(configService.get('helmet')));

    // Enable CORS
    app.enableCors(configService.get('cors'));

    // Apply global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Strip properties not in DTO
        transform: true, // Transform payloads to DTO instances
        forbidUnknownValues: true, // Throw error on unknown properties
      }),
    );

    // Enable cookie parsing
    app.use(cookieParser());

    // Enable compression
    app.use(compression());

    // Simple health check endpoint for Docker
    app.getHttpAdapter().get('/health', (req, res) => {
      res.status(200).send('OK');
    });

    // Setup Swagger docs
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('SwiftBoard API')
        .setDescription('The SwiftBoard API documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api-docs', app, document);
    }

    // Get port from environment or use default
    const port = configService.get('PORT', 8000);

    // Start the application
    await app.listen(port);

    logger.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

// For serverless environments
export const handler = async (req, res) => {
  const app = await NestFactory.create(AppModule);
  await app.init();
  const expressInstance = app.getHttpAdapter().getInstance();
  return expressInstance(req, res);
};

bootstrap();
