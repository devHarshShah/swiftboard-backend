import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { NoCache } from './common/decorators/cache.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @NoCache() // Don't cache the welcome page
  @ApiOperation({ summary: 'Welcome endpoint' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @NoCache() // Don't cache health checks
  @ApiOperation({ summary: 'Basic health check endpoint' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
