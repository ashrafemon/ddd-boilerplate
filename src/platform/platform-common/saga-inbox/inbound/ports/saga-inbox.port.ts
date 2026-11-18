import { SagaInboxRecord } from '../../types/saga-inbox.types';
import { InsertInboxInput } from '../../outbound/ports/saga-inbox.repository.port';

/**
 * Public Saga Inbox capability — the ONLY saga-inbox seam the runtime consumes.
 *
 * `saga-inbox` owns the `saga_inbox` ledger: dedupe on delivery, buffering until
 * a WAIT step can consume the event, and retention. The saga engine never sees
 * the repository; it asks this port to record, read, consume or ignore events.
 */
export abstract class SagaInboxPort {
  /**
   * Record a delivery for a live instance. `false` means it was already
   * recorded (redelivery) and the instance must not advance again.
   */
  abstract buffer(request: InsertInboxInput): Promise<boolean>;

  /** Candidate BUFFERED events for one contract, oldest first. */
  abstract listBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInboxRecord[]>;

  /**
   * Mark one buffered event consumed, after the WAIT step row exists.
   * `false` = another worker consumed it first (same outcome, redundant work).
   */
  abstract markConsumed(id: string): Promise<boolean>;

  /**
   * Park still-buffered events of one contract as IGNORED with a reason — used
   * when a WAIT step times out and the plan skips it.
   */
  abstract ignoreBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    reason: string,
  ): Promise<number>;
}
