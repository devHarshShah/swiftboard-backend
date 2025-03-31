import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { CustomMailerModule } from './custommailer/custommailer.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { WorkflowModule } from './workflow/workflow.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './logger/logger.module';
import { ErrorModule } from './error/error.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    ErrorModule, // Add this at the top to ensure it's available to all other modules
    AuthModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
    RedisModule,
    LoggerModule,
    HealthModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
