import { Injectable } from '@nestjs/common';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '../../shared-kernel/ports/observability/metrics.port';
import { WorkflowDefinition } from './workflow-definition';

/**
 * Executes workflow definitions step by step. When a step fails, the
 * compensation of every already executed step runs in reverse order.
 */
@Injectable()
export class WorkflowEngine {
  constructor(
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {
    this.metrics.registerCounter({
      name: 'erp_workflow_steps_total',
      help: 'Workflow steps executed by outcome',
      labelNames: ['workflow', 'status'],
    });
  }

  public async execute<TContext>(
    definition: WorkflowDefinition<TContext>,
    context: TContext,
  ): Promise<void> {
    const executed: Array<{ step: WorkflowStepLike<TContext>; context: TContext }> = [];

    this.logger.info('workflow-started', { workflow: definition.name });

    for (const step of definition.steps) {
      if (step.when && !step.when(context)) {
        this.logger.debug('workflow-step-skipped', { workflow: definition.name, step: step.name });
        continue;
      }

      try {
        await step.execute(context);
        executed.push({ step, context });
        this.metrics.incrementCounter('erp_workflow_steps_total', {
          workflow: definition.name,
          status: 'success',
        });
      } catch (error) {
        this.metrics.incrementCounter('erp_workflow_steps_total', {
          workflow: definition.name,
          status: 'failed',
        });
        this.logger.error('workflow-step-failed', {
          workflow: definition.name,
          step: step.name,
          error: errorMessageOf(error),
        });
        await this.compensate(definition, executed);
        throw error;
      }
    }

    this.logger.info('workflow-completed', { workflow: definition.name });
  }

  private async compensate<TContext>(
    definition: WorkflowDefinition<TContext>,
    executed: Array<{ step: WorkflowStepLike<TContext>; context: TContext }>,
  ): Promise<void> {
    for (const entry of [...executed].reverse()) {
      if (!entry.step.compensate) continue;
      try {
        await entry.step.compensate(entry.context);
        this.metrics.incrementCounter('erp_workflow_steps_total', {
          workflow: definition.name,
          status: 'compensated',
        });
      } catch (error) {
        this.metrics.incrementCounter('erp_workflow_steps_total', {
          workflow: definition.name,
          status: 'compensation_failed',
        });
        this.logger.error('workflow-compensation-failed', {
          workflow: definition.name,
          step: entry.step.name,
          error: errorMessageOf(error),
        });
      }
    }
  }
}

interface WorkflowStepLike<TContext> {
  name: string;
  execute(context: TContext): Promise<void> | void;
  compensate?(context: TContext): Promise<void> | void;
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
