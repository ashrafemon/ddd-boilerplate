import { HealthReport } from '../types/health.types';

/**
 * Inbound port: aggregated infrastructure health for orchestration
 * readiness/liveness probes. Implemented on top of the raw infrastructure
 * clients, never over business modules.
 */
export abstract class HealthPort {
  abstract check(): Promise<HealthReport>;
}
