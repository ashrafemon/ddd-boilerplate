import {
  InboxReceiveRequest,
  InboxReceiveResult,
  InboxCompleteRequest,
  InboxFailRequest,
} from '../inbox.types';

/**
 * Inbox — the only port. Inject it at the top of every broker or event
 * consumer: only `ACQUIRED` proceeds to the listener, and the broker ACK only
 * fires after `complete`.
 *
 *   const delivery = await this.inbox.receive({ consumer, messageId, ... });
 *   if (delivery.status !== 'ACQUIRED') return;
 *   await this.inbox.complete({ reservation: delivery.reservation });
 */
export abstract class InboxPort {
  abstract receive(request: InboxReceiveRequest): Promise<InboxReceiveResult>;
  abstract complete(request: InboxCompleteRequest): Promise<void>;
  abstract fail(request: InboxFailRequest): Promise<void>;
}
