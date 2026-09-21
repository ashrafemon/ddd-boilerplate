import {
  SagaInstance,
  SagaStepExecution,
  SagaCompanyConfig,
  SagaEventSubscription,
  SagaStepConfig,
  SagaCompensationConfig,
} from '../saga.types';

/**
 * Repository port for Saga persistence.
 * Internal to the Saga module — business modules consume only SagaPort.
 */
export abstract class SagaRepositoryPort {
  // ─── Instance ──────────────────────────────────────────────────────

  abstract findInstanceById(id: string): Promise<SagaInstance | null>;

  abstract findInstanceByCorrelation(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    correlationId: string,
  ): Promise<SagaInstance | null>;

  abstract createInstance(instance: {
    tenantId: string;
    organizationId: string;
    sagaType: string;
    sagaVersion: number;
    correlationId: string;
    status: string;
    currentStep: string | null;
    state: unknown;
    claimToken: string;
  }): Promise<SagaInstance>;

  abstract updateInstanceStatus(
    id: string,
    claimToken: string,
    version: number,
    status: string,
    patch: Partial<{
      currentStep: string | null;
      state: unknown;
      lastError: string | null;
      completedAt: Date;
      failedAt: Date;
    }>,
  ): Promise<boolean>;

  // ─── Step Execution ────────────────────────────────────────────────

  abstract findStepExecution(
    sagaInstanceId: string,
    stepName: string,
  ): Promise<SagaStepExecution | null>;

  abstract createStepExecution(step: {
    sagaInstanceId: string;
    stepName: string;
    status: string;
    claimToken: string;
  }): Promise<SagaStepExecution>;

  abstract updateStepStatus(
    id: string,
    claimToken: string,
    version: number,
    status: string,
    patch: Partial<{
      attempts: number;
      commandId: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      availableAt: Date | null;
      lastError: string | null;
    }>,
  ): Promise<boolean>;

  abstract releaseExpiredStepClaims(now: Date, claimLeaseMs: number): Promise<number>;

  // ─── Company Configuration ─────────────────────────────────────────

  abstract findCompanyConfig(
    tenantId: string,
    organizationId: string,
    sagaType: string,
  ): Promise<SagaCompanyConfig | null>;

  abstract findEventSubscription(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    eventType: string,
    eventVersion: number,
  ): Promise<SagaEventSubscription | null>;

  abstract findStepConfig(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    stepName: string,
  ): Promise<SagaStepConfig | null>;

  abstract findCompensationConfigs(
    tenantId: string,
    organizationId: string,
    sagaType: string,
  ): Promise<SagaCompensationConfig[]>;
}
