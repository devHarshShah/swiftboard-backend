import { Module } from '@nestjs/common';
import { ChatGateway } from './chat-gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RedisModule } from 'src/redis/redis.module';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [RedisModule],
  providers: [ChatGateway, ChatService, LoggerService],
  controllers: [ChatController],
})
export class ChatModule {}
