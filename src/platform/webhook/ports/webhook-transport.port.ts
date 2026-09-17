export interface WebhookTransportResponse {
  statusCode: number;
}

/** Outbound HTTP delivery. Throws on network/timeout error; a non-2xx status
 * is a normal return value, not an exception — the use case decides retry. */
export abstract class WebhookTransportPort {
  abstract post(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<WebhookTransportResponse>;
}
