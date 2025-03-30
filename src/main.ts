import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Winston for application logging
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = new DocumentBuilder()
    .setTitle('Project Management API')
    .setDescription(
      'API documentation for managing projects, tasks, and subtasks',
    )
    .setVersion('1.0')
    .addBearerAuth() // If using JWT authentication
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // Swagger UI will be available at /api/docs

  await app.listen(8000);
}
bootstrap();
