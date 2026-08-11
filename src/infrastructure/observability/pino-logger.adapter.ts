import { Injectable } from '@nestjs/common';
import pino from 'pino';
import { ConfigurationService } from '../../config/config.service';
import { LogFields, LoggerPort } from '../../shared-kernel/ports/observability/logger.port';

/**
 * Pino-based structured logger.
 */
@Injectable()
export class PinoLoggerAdapter implements LoggerPort {
  private readonly logger: pino.Logger;

  constructor(configuration: ConfigurationService) {
    this.logger = pino({
      level: configuration.logLevel,
      base: { app: configuration.appName, env: configuration.env },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          'password',
          '*.password',
          '*.secret',
          '*.token',
          'authorization',
          '*.apiKey',
          '*.key',
        ],
        censor: '[REDACTED]',
      },
    });
  }

  public debug(message: string, fields?: LogFields): void {
    this.logger.debug(fields ?? {}, message);
  }

  public info(message: string, fields?: LogFields): void {
    this.logger.info(fields ?? {}, message);
  }

  public warn(message: string, fields?: LogFields): void {
    this.logger.warn(fields ?? {}, message);
  }

  public error(message: string, fields?: LogFields): void {
    this.logger.error(fields ?? {}, message);
  }

  public fatal(message: string, fields?: LogFields): void {
    this.logger.fatal(fields ?? {}, message);
  }
}
