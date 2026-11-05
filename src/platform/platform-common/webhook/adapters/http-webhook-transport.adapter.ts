import { Injectable } from '@nestjs/common';
import { WebhookTransportPort, WebhookTransportResponse } from '../ports/webhook-transport.port';

/**
 * Outbound HTTP delivery over Node's built-in fetch. A non-2xx response is a
 * normal return value (the use case decides retry/dead-letter); a
 * network/timeout failure throws.
 */
@Injectable()
export class HttpWebhookTransportAdapter implements WebhookTransportPort {
  async post(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<WebhookTransportResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return { statusCode: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }
}
