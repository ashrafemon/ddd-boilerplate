import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotentScope';

/**
 * Marks a route idempotent via the `platform/idempotency` ledger. The caller
 * must send an `Idempotency-Key` header; the operation scope is derived from
 * the controller/method (not configurable — one decorator per route).
 *
 * - First call with a key: executes and stores the response.
 * - Retry with a COMPLETED key: replays the stored response (no re-execution).
 * - Concurrent second call (IN_PROGRESS): 409 Conflict — safe to retry later.
 * - Failed executions are re-acquirable immediately (no duplicate charge/run).
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

export const IDEMPOTENCY_HEADER = 'idempotency-key';
