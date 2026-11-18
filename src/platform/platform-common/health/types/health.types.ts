/** Per-component health as seen by the readiness probe. */
export type HealthStatus = 'up' | 'down' | 'disabled';

export interface HealthReport {
  /** `ok` when no enabled component is down; `degraded` otherwise. */
  status: 'ok' | 'degraded';
  components: Record<string, HealthStatus>;
}
