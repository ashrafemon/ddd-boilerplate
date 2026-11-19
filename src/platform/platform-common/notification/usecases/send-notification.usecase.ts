import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { NotificationHandlerRegistry } from '../notification-handler.registry';
import { NotificationWorker } from '../notification.worker';
import { NotificationPreferenceRepositoryPort } from '../ports/notification-preference-repository.port';
import { NotificationQueuePublisherPort } from '../ports/notification-queue-publisher.port';
import { NotificationRequestRepositoryPort } from '../ports/notification-request-repository.port';
import { NotificationSuppressionRepositoryPort } from '../ports/notification-suppression-repository.port';

import {
  NewNotificationMessage,
  NotificationContext,
  NotificationDispatch,
  NotificationMode,
  NotificationRequestRecord,
  NotifyInput,
  Recipient,
} from '../notification.types';

/**
 * PHASES 1-3. Dedup, resolve the domain handler for WHO/WITH WHAT DATA, run
 * the mandatory preference + suppression gate, pre-create one message per
 * surviving/suppressed pair, decide Sync vs Async, then dispatch. Never
 * renders a template or calls a channel provider directly — that is Phase 5.
 */
@Injectable()
export class SendNotificationUseCase {
  constructor(
    private readonly requests: NotificationRequestRepositoryPort,
    private readonly preferences: NotificationPreferenceRepositoryPort,
    private readonly suppressions: NotificationSuppressionRepositoryPort,
    private readonly registry: NotificationHandlerRegistry,
    private readonly worker: NotificationWorker,
    private readonly queuePublisher: NotificationQueuePublisherPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: NotifyInput): Promise<NotificationRequestRecord> {
    const existing = await this.requests.findByDedupKey(input.tenantId, input.dedupKey);
    if (existing) {
      return existing;
    }

    const handler = this.registry.resolveHandler(input.notificationType);
    const declaredChannels = this.registry.declaredChannels(input.notificationType);
    const priority = input.priority ?? this.registry.defaultPriority(input.notificationType);
    const { payloadMaxBytes, maxRecipientsPerRequest, syncMessageThreshold } =
      this.configService.getNotificationPipeline();

    let request = await this.requests.createRequest({
      notificationType: input.notificationType,
      dedupKey: input.dedupKey,
      sourceEvent: input.sourceEvent,
      payload: capPayload(input.payload ?? null, payloadMaxBytes),
      priority,
      tenantId: input.tenantId ?? null,
      requestedBy: input.requestedBy ?? null,
    });

    const context: NotificationContext = {
      tenantId: input.tenantId,
      notificationRequestId: request.id,
      notificationType: input.notificationType,
      traceId: input.traceId,
    };

    // FIRST and ONLY notificationType-specific code in this path.
    const recipients = await handler.resolveRecipients(input.payload, context);
    if (recipients.length === 0) {
      return this.requests.finaliseNoRecipients(request.id);
    }
    await handler.resolveModel(input.payload, context);

    const pairs = expandPairs(recipients, declaredChannels);
    if (pairs.length > maxRecipientsPerRequest) {
      throw new UnprocessableEntityException(
        `Fan-out of ${pairs.length} messages exceeds the maximum of ${maxRecipientsPerRequest} per notification request`,
      );
    }

    const newMessages: NewNotificationMessage[] = [];
    for (const { recipient, channel } of pairs) {
      // THE GATE — preference (consent) then suppression (compliance), in that
      // order. A missing preference row means the platform default (opted in)
      // applies; the hard block-list is only checkable once an address is known.
      const address = recipient.address ?? null;
      const base = {
        recipientRef: recipient.recipientRef,
        channel,
        address,
        locale: recipient.locale ?? null,
      };

      const prefs = await this.preferences.findForRecipient(input.tenantId, recipient.recipientRef);
      const optedOut = prefs.some(
        p =>
          p.category === input.notificationType &&
          (p.channel === channel || p.channel === 'ALL') &&
          !p.optedIn,
      );
      if (optedOut) {
        newMessages.push({ ...base, status: 'SUPPRESSED', suppressReason: 'PREFERENCE' });
        continue;
      }

      if (address) {
        const suppressed = await this.suppressions.isSuppressed(input.tenantId, address, channel);
        if (suppressed) {
          newMessages.push({ ...base, status: 'SUPPRESSED', suppressReason: 'HARD_BOUNCE' });
          continue;
        }
      }

      newMessages.push({ ...base, status: 'PENDING', suppressReason: null });
    }

    const pendingCount = newMessages.filter(m => m.status === 'PENDING').length;
    const mode: NotificationMode =
      pendingCount <= syncMessageThreshold && priority === 'HIGH' ? 'SYNC' : 'ASYNC';

    const attached = await this.requests.attachMessages(request.id, mode, newMessages);
    request = attached.request;

    const pendingIds = attached.messages.filter(m => m.status === 'PENDING').map(m => m.id);
    if (pendingIds.length === 0) {
      return this.requests.finalise(request.id);
    }

    const dispatch: NotificationDispatch = {
      notificationRequestId: request.id,
      notificationType: request.notificationType,
      tenantId: request.tenantId ?? undefined,
      traceId: input.traceId,
      defaultLocale: undefined,
      messageIds: pendingIds,
    };

    if (mode === 'SYNC') {
      // Producer/Consumer half skipped — same worker code path either way.
      await this.worker.processChunk(dispatch);
      return (await this.requests.findById(request.id)) ?? request;
    }

    try {
      await this.queuePublisher.dispatchChunks(dispatch);
    } catch (err) {
      await this.requests.finalise(request.id);
      throw err;
    }
    return request;
  }
}

class NotificationUtils {
  static expandPairs(
    recipients: Recipient[],
    declaredChannels: string[],
  ): Array<{ recipient: Recipient; channel: string }> {
    return recipients.flatMap(recipient => {
      const channels = recipient.channelHints?.length ? recipient.channelHints : declaredChannels;
      return channels.map(channel => ({ recipient, channel }));
    });
  }

  static capPayload(
    payload: Record<string, unknown> | null,
    maxBytes: number,
  ): Record<string, unknown> | null {
    if (!payload) {
      return null;
    }
    const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (size <= maxBytes) {
      return payload;
    }
    return { _truncated: true, _originalBytes: size };
  }
}

function expandPairs(
  recipients: Recipient[],
  declaredChannels: string[],
): Array<{ recipient: Recipient; channel: string }> {
  return NotificationUtils.expandPairs(recipients, declaredChannels);
}

function capPayload(
  payload: Record<string, unknown> | null,
  maxBytes: number,
): Record<string, unknown> | null {
  return NotificationUtils.capPayload(payload, maxBytes);
}
