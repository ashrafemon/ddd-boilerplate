import { NotificationRequestRecord } from '../notification.types';

/**
 * Writes a request-lifecycle event to the transactional outbox for downstream
 * consumers (audit, metrics). A failed write must never re-run the request.
 */
export abstract class NotificationOutboxWriterPort {
  abstract writeRequestCompletedEvent(request: NotificationRequestRecord): Promise<void>;
}
