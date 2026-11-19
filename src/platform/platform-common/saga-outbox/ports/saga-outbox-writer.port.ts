import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';

/**
 * Public write seam onto the saga's ledger (`saga_outbox`).
 *
 * Same call shape as the shared `OutboxWriterPort`: append one event inside the
 * caller's `@Transactional()` scope, nothing leaves the process. The saga's
 * lifecycle events therefore commit atomically with the step/instance CAS that
 * produced them, but are published by the saga dispatcher on its own schedule.
 */
export abstract class SagaOutboxWriterPort extends OutboxWriterPort {}
