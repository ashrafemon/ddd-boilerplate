import {
  InboxReceiveRequest,
  InboxReceiveResult,
  InboxCompleteRequest,
  InboxFailRequest,
} from '../inbox.types';

/**
 * Inbox — durable inbound message claim and deduplication boundary.
 *
 * The Inbox is the consumer-side counterpart of Outbox.
 * Outbox protects reliable publication; Inbox protects reliable consumption.
 *
 * Business modules consume only InboxPort.
 * They do not consume InboxRepositoryPort or PrismaInboxRepository.
 */
export abstract class InboxPort {
  /** Try to receive/claim an inbound message. Returns ACQUIRED/PROCESSED/IN_PROGRESS/etc. */
  abstract receive(request: InboxReceiveRequest): Promise<InboxReceiveResult>;

  /** Mark the reservation as PROCESSED. */
  abstract complete(request: InboxCompleteRequest): Promise<void>;

  /** Mark the reservation as FAILED — allows retry. */
  abstract fail(request: InboxFailRequest): Promise<void>;
}
