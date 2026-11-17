/** Per-component health as seen by the readiness probe. */
export type HealthStatus = 'up' | 'down' | 'disabled';

export interface HealthReport {
  /** `ok` when no enabled component is down; `degraded` otherwise. */
  status: 'ok' | 'degraded';
  components: Record<string, HealthStatus>;
}

/**
 * Aggregated infrastructure health for orchestration readiness/liveness
 * probes. Implemented by the platform health adapter on top of the raw
 * infrastructure clients.
 */
export abstract class HealthPort {
  abstract check(): Promise<HealthReport>;
}
