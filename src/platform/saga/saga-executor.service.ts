import { Injectable } from '@nestjs/common';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '../../shared-kernel/ports/observability/metrics.port';
import { SagaDefinition } from './saga-definition';

/**
 * Executes saga definitions with step retry and reverse compensation.
 *
 * `run` is idempotent-safe by correlation: callers pass a saga state that
 * carries the correlation id and the saga records per-instance progress in
 * memory (replace with a persistent saga state store for production).
 */
@Injectable()
export class SagaExecutor {
  private readonly instances = new Map<string, Set<string>>();

  constructor(
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {
    this.metrics.registerCounter({
      name: 'erp_saga_steps_total',
      help: 'Saga steps by outcome',
      labelNames: ['saga', 'status'],
    });
  }

  public async run<TState extends { correlationId: string }>(
    definition: SagaDefinition<TState>,
    state: TState,
  ): Promise<void> {
    const instanceId = `${definition.name}:${state.correlationId}`;
    const completedSteps = this.instances.get(instanceId) ?? new Set<string>();
    this.instances.set(instanceId, completedSteps);

    this.logger.info('saga-started', { saga: definition.name, correlationId: state.correlationId });

    for (const step of definition.steps) {
      if (completedSteps.has(step.name)) {
        this.logger.debug('saga-step-already-completed', {
          saga: definition.name,
          step: step.name,
        });
        continue;
      }

      const maxAttempts = step.maxAttempts ?? 1;
      let lastError: unknown;
      let succeeded = false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          await step.invoke(state);
          completedSteps.add(step.name);
          this.metrics.incrementCounter('erp_saga_steps_total', { saga: definition.name, status: 'success' });
          succeeded = true;
          break;
        } catch (error) {
          lastError = error;
          this.metrics.incrementCounter('erp_saga_steps_total', { saga: definition.name, status: 'retry' });
          if (attempt < maxAttempts - 1) {
            await sleep(step.backoffMs ?? 1_000);
          }
        }
      }

      if (!succeeded) {
        this.metrics.incrementCounter('erp_saga_steps_total', { saga: definition.name, status: 'failed' });
        await this.compensate(definition, state, completedSteps);
        throw lastError;
      }
    }

    this.logger.info('saga-completed', { saga: definition.name, correlationId: state.correlationId });
  }

  private async compensate<TState extends { correlationId: string }>(
    definition: SagaDefinition<TState>,
    state: TState,
    completedSteps: Set<string>,
  ): Promise<void> {
    const completed = definition.steps.filter((step) => completedSteps.has(step.name));
    for (const step of [...completed].reverse()) {
      if (!step.compensate) continue;
      try {
        await step.compensate(state);
        this.metrics.incrementCounter('erp_saga_steps_total', { saga: definition.name, status: 'compensated' });
      } catch (error) {
        this.metrics.incrementCounter('erp_saga_steps_total', {
          saga: definition.name,
          status: 'compensation_failed',
        });
        this.logger.error('saga-compensation-failed', {
          saga: definition.name,
          step: step.name,
          correlationId: state.correlationId,
          error: errorMessageOf(error),
        });
      }
    }
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
