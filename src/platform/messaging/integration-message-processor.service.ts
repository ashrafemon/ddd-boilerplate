import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RequestContextPort } from '../../shared-kernel/ports/context/request-context.port';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { IntegrationMessage } from '../../shared-kernel/ports/messaging/integration-message';
import { IntegrationMessageRouter } from './integration-message-router';

export type MessageProcessingResult = 'PROCESSED' | 'SKIPPED';

/**
 * Shared message processing pipeline used by every transport consumer
 * (RabbitMQ, Kafka, SQS).
 *
 * Flow:
 *   1. Re-establish tenant/organization/correlation context in CLS.
 *   2. Idempotency check through the platform idempotency service
 *      (at-least-once delivery safety).
 *   3. Route to the handlers registered by business modules.
 *   4. Mark the inbox record processed.
 */
@Injectable()
export class IntegrationMessageProcessor {
  constructor(
    private readonly cls: ClsService,
    private readonly requestContext: RequestContextPort,
    private readonly idempotency: IdempotencyService,
    private readonly router: IntegrationMessageRouter,
    private readonly logger: LoggerPort,
  ) {}

  public async process(message: IntegrationMessage): Promise<MessageProcessingResult> {
    return this.cls.runWith({}, async () => {
      this.requestContext.set({
        requestId: message.eventId,
        correlationId: message.correlationId ?? message.eventId,
        tenantId: message.tenantId,
        organizationId: message.organizationId,
      });

      const shouldProcess = await this.idempotency.shouldProcess(
        message.eventId,
        message.eventType,
        message.payload,
      );

      if (!shouldProcess) {
        this.logger.debug('integration-message-duplicate-skipped', {
          eventId: message.eventId,
          eventType: message.eventType,
        });
        return 'SKIPPED';
      }

      try {
        await this.router.route(message);
        await this.idempotency.markProcessed(message.eventId, message.eventType);
        return 'PROCESSED';
      } catch (error) {
        await this.idempotency.markFailed(message.eventId, message.eventType, errorMessageOf(error));
        throw error;
      }
    });
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
