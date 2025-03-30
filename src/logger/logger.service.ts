import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Inject } from '@nestjs/common';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: WinstonLogger,
  ) {}

  setContext(context: string) {
    this.context = context;
    return this;
  }

  log(message: any, context?: string) {
    return this.logger.info(message, { context: context || this.context });
  }

  error(message: any, trace?: string, context?: string) {
    return this.logger.error(message, {
      trace,
      context: context || this.context,
    });
  }

  warn(message: any, metadataOrContext?: any | string) {
    if (typeof metadataOrContext === 'string') {
      return this.logger.warn(message, {
        context: metadataOrContext || this.context,
      });
    } else {
      return this.logger.warn(message, {
        context: this.context,
        ...metadataOrContext,
      });
    }
  }

  debug(message: any, context?: string) {
    return this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: any, context?: string) {
    return this.logger.verbose(message, { context: context || this.context });
  }
}
