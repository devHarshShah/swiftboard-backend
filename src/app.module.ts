import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@nestjs-modules/ioredis';
import { validateEnv } from './configs/env.validation';
import corsConfig from './configs/cors.config';
import helmetConfig from './configs/helmet.config';
import jwtConfig from './auth/configs/jwt.config';
import { DatabaseSecurityService } from './common/services/database-security.service';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { LoggerService } from './logger/logger.service';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { FileUploadService } from './common/services/file-upload.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { CustomMailerModule } from './custommailer/custommailer.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { WorkflowModule } from './workflow/workflow.module';
import { LoggerModule } from './logger/logger.module';
import { ErrorModule } from './error/error.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [corsConfig, helmetConfig, jwtConfig],
    }),

    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get('REDIS_HOST', 'localhost')}:${configService.get('REDIS_PORT', 6379)}`,
        password: configService.get('REDIS_PASSWORD'),
      }),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10,
      },
    ]),

    ErrorModule, // Add this at the top to ensure it's available to all other modules
    AuthModule,
    PrismaModule,
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      defaults: {
        from: '"No Reply" <your-email@example.com>', // Ensure this matches your email service
      },
    }),
    TeamsModule,
    ProjectsModule,
    TasksModule,
    UsersModule,
    CustomMailerModule,
    ChatModule,
    NotificationModule,
    WorkflowModule,
    LoggerModule,
    HealthModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    RateLimitGuard,
    DatabaseSecurityService,
    LoggerService,
    FileUploadService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
