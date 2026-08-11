import { z } from 'zod';
import { numberFromString } from '../env-helpers';

/**
 * Platform group — settings for platform-managed services (transactional
 * outbox polling, idempotency, saga/workflow behavior).
 */
export const platformConfigSchema = z.object({
  OUTBOX_POLL_INTERVAL_MS: numberFromString(5000),
  OUTBOX_BATCH_SIZE: numberFromString(50),
  OUTBOX_MAX_ATTEMPTS: numberFromString(5),
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;
