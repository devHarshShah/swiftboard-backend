import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { LoggerService } from './logger/logger.service';
import { RequestValidationMiddleware } from './common/middleware/request-validation.middleware';
import { ResponseTimeMiddleware } from './common/middleware/response-time.middleware';

async function bootstrap() {
  // Create app with logger
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get our logger service
  const logger = app.get(LoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  app.use(helmet());

  app.use(compression());
  app.use(new RequestValidationMiddleware(logger).use);
  app.use(new ResponseTimeMiddleware(logger).middleware);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('SwiftBoard API')
    .setDescription('SwiftBoard Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 8000;
  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start the application:', err);
  process.exit(1);
});
