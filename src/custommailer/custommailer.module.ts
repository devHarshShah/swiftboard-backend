import { Module } from '@nestjs/common';
import { CustomMailerService } from './custommailer.service';

@Module({
  providers: [CustomMailerService],
})
export class CustomMailerModule {}
