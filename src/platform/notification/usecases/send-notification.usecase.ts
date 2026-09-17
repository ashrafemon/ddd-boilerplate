import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { NotificationHandlerRegistry } from '../notification-handler.registry';
import { NotificationWorker } from '../notification.worker';
import { NotificationPreferenceRepositoryPort } from '../ports/notification-preference-repository.port';
import { NotificationQueuePublisherPort } from '../ports/notification-queue-publisher.port';
import { NotificationRequestRepositoryPort } from '../ports/notification-request-repository.port';
import { NotificationSuppressionRepositoryPort } from '../ports/notification-suppression-repository.port';
import { NotificationSelectionTooLargeError } from '../notification.errors';
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
      throw new NotificationSelectionTooLargeError(pairs.length, maxRecipientsPerRequest);
    }

    const newMessages: NewNotificationMessage[] = [];
    for (const { recipient, channel } of pairs) {
      newMessages.push(await this.gate(input.tenantId, input.notificationType, recipient, channel));
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

  /** THE GATE — preference (consent) then suppression (compliance), in that order. */
  private async gate(
    tenantId: string | undefined,
    notificationType: string,
    recipient: Recipient,
    channel: string,
  ): Promise<NewNotificationMessage> {
    const address = recipient.address ?? null;
    const base = {
      recipientRef: recipient.recipientRef,
      channel,
      address,
      locale: recipient.locale ?? null,
    };

    // Consent: a missing preference row means the platform default (opted in) applies.
    const prefs = await this.preferences.findForRecipient(tenantId, recipient.recipientRef);
    const optedOut = prefs.some(
      p =>
        p.category === notificationType &&
        (p.channel === channel || p.channel === 'ALL') &&
        !p.optedIn,
    );
    if (optedOut) {
      return { ...base, status: 'SUPPRESSED', suppressReason: 'PREFERENCE' };
    }

    // Compliance: the hard block-list. Only checkable once an address is known.
    if (address) {
      const suppressed = await this.suppressions.isSuppressed(tenantId, address, channel);
      if (suppressed) {
        return { ...base, status: 'SUPPRESSED', suppressReason: 'HARD_BOUNCE' };
      }
    }

    return { ...base, status: 'PENDING', suppressReason: null };
  }
}

function expandPairs(
  recipients: Recipient[],
  declaredChannels: string[],
): Array<{ recipient: Recipient; channel: string }> {
  return recipients.flatMap(recipient => {
    const channels = recipient.channelHints?.length ? recipient.channelHints : declaredChannels;
    return channels.map(channel => ({ recipient, channel }));
  });
}

function capPayload(
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
