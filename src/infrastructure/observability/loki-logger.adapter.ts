import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.service';
import { LogFields, LoggerPort } from '../../shared-kernel/ports/observability/logger.port';

const LOKI_PUSH_PATH = '/loki/api/v1/push';

/**
 * Loki log adapter that pushes structured JSON log streams to a Grafana Loki
 * gateway. Enabled only when LOKI_URL is configured.
 */
@Injectable()
export class LokiLoggerAdapter implements LoggerPort {
  private readonly enabled: boolean;
  private readonly url: string;
  private readonly labels: Record<string, string>;

  constructor(private readonly configuration: ConfigurationService) {
    const loki = configuration.getLoki();
    this.enabled = loki.enabled && loki.url.length > 0;
    this.url = loki.url;
    this.labels = { app: configuration.appName, env: configuration.env };
  }

  public debug(message: string, fields?: LogFields): void {
    void this.push('debug', message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    void this.push('info', message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    void this.push('warn', message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    void this.push('error', message, fields);
  }

  public fatal(message: string, fields?: LogFields): void {
    void this.push('fatal', message, fields);
  }

  private async push(level: string, message: string, fields?: LogFields): Promise<void> {
    if (!this.enabled) return;
    const stream = { ...this.labels, level };
    const entry = { ts: new Date().toISOString(), line: JSON.stringify({ message, ...(fields ?? {}) }) };
    try {
      await fetch(`${this.url}${LOKI_PUSH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams: [{ stream, values: [[entry.ts, entry.line]] }] }),
      });
    } catch {
      // Logging must never break business logic.
    }
  }
}
