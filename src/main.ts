import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
