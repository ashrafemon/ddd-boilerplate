import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.service';
import { LogFields, LoggerPort } from '../../shared-kernel/ports/observability/logger.port';

/**
 * Console logger used in tests and local development. Kept as a lightweight
 * alternative to the pino adapter.
 */
@Injectable()
export class ConsoleLoggerAdapter implements LoggerPort {
  constructor(private readonly configuration: ConfigurationService) {}

  public debug(message: string, fields?: LogFields): void {
    this.write('debug', message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }

  public fatal(message: string, fields?: LogFields): void {
    this.write('fatal', message, fields);
  }

  private write(level: string, message: string, fields?: LogFields): void {
    const line = `[${level.toUpperCase()}] ${message} ${fields ? JSON.stringify(fields) : ''}`;
    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else {
      console.log(line);
    }
    void this.configuration;
  }
}
