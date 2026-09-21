/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { SagaRepositoryPort } from '../ports/saga-repository.port';
import {
  SagaInstance,
  SagaStepExecution,
  SagaCompanyConfig,
  SagaEventSubscription,
  SagaStepConfig,
  SagaCompensationConfig,
} from '../saga.types';

/**
 * In-memory saga repository for unit tests.
 */
export class InMemorySagaRepository implements SagaRepositoryPort {
  private instances = new Map<string, SagaInstance>();
  private stepExecutions = new Map<string, SagaStepExecution>();
  private companyConfigs = new Map<string, SagaCompanyConfig>();
  private eventSubscriptions = new Map<string, SagaEventSubscription>();
  private stepConfigs = new Map<string, SagaStepConfig>();
  private compensationConfigs = new Map<string, SagaCompensationConfig>();

  async findInstanceById(id: string): Promise<SagaInstance | null> {
    return this.instances.get(id) ?? null;
  }

  async findInstanceByCorrelation(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    correlationId: string,
  ): Promise<SagaInstance | null> {
    for (const inst of this.instances.values()) {
      if (
        inst.tenantId === tenantId &&
        inst.organizationId === organizationId &&
        inst.sagaType === sagaType &&
        inst.correlationId === correlationId
      ) {
        return inst;
      }
    }
    return null;
  }

  async createInstance(data: {
    tenantId: string;
    organizationId: string;
    sagaType: string;
    sagaVersion: number;
    correlationId: string;
    status: string;
    currentStep: string | null;
    state: unknown;
    claimToken: string;
  }): Promise<SagaInstance> {
    const now = new Date();
    const instance: SagaInstance = {
      id: randomUUID(),
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      sagaType: data.sagaType,
      sagaVersion: data.sagaVersion,
      correlationId: data.correlationId,
      status: data.status as SagaInstance['status'],
      currentStep: data.currentStep,
      state: data.state,
      startedAt: now,
      completedAt: null,
      failedAt: null,
      lastError: null,
      claimToken: data.claimToken,
      claimedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.instances.set(instance.id, instance);
    return instance;
  }

  async updateInstanceStatus(
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
  ): Promise<boolean> {
    const inst = this.instances.get(id);
    if (!inst) return false;
    if (inst.claimToken !== claimToken || inst.version !== version) return false;

    inst.status = status as SagaInstance['status'];
    inst.version += 1;
    inst.updatedAt = new Date();
    if (patch.currentStep !== undefined) inst.currentStep = patch.currentStep;
    if (patch.state !== undefined) inst.state = patch.state;
    if (patch.lastError !== undefined) inst.lastError = patch.lastError;
    if (patch.completedAt) inst.completedAt = patch.completedAt;
    if (patch.failedAt) inst.failedAt = patch.failedAt;
    return true;
  }

  async findStepExecution(
    sagaInstanceId: string,
    stepName: string,
  ): Promise<SagaStepExecution | null> {
    for (const step of this.stepExecutions.values()) {
      if (step.sagaInstanceId === sagaInstanceId && step.stepName === stepName) {
        return step;
      }
    }
    return null;
  }

  async createStepExecution(data: {
    sagaInstanceId: string;
    stepName: string;
    status: string;
    claimToken: string;
  }): Promise<SagaStepExecution> {
    const now = new Date();
    const step: SagaStepExecution = {
      id: randomUUID(),
      sagaInstanceId: data.sagaInstanceId,
      stepName: data.stepName,
      status: data.status as SagaStepExecution['status'],
      attempts: 1,
      commandId: null,
      startedAt: now,
      completedAt: null,
      availableAt: null,
      lastError: null,
      claimToken: data.claimToken,
      claimedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.stepExecutions.set(step.id, step);
    return step;
  }

  async updateStepStatus(
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
  ): Promise<boolean> {
    const step = this.stepExecutions.get(id);
    if (!step) return false;
    if (step.claimToken !== claimToken || step.version !== version) return false;

    step.status = status as SagaStepExecution['status'];
    step.version += 1;
    step.updatedAt = new Date();
    if (patch.attempts !== undefined) step.attempts = patch.attempts;
    if (patch.commandId !== undefined) step.commandId = patch.commandId;
    if (patch.startedAt !== undefined) step.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) step.completedAt = patch.completedAt;
    if (patch.availableAt !== undefined) step.availableAt = patch.availableAt;
    if (patch.lastError !== undefined) step.lastError = patch.lastError;
    return true;
  }

  async releaseExpiredStepClaims(): Promise<number> {
    return 0;
  }

  async findCompanyConfig(
    tenantId: string,
    organizationId: string,
    sagaType: string,
  ): Promise<SagaCompanyConfig | null> {
    const key = `${tenantId}:${organizationId}:${sagaType}`;
    return this.companyConfigs.get(key) ?? null;
  }

  async findEventSubscription(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    eventType: string,
    eventVersion: number,
  ): Promise<SagaEventSubscription | null> {
    const key = `${tenantId}:${organizationId}:${sagaType}:${eventType}:${eventVersion}`;
    return this.eventSubscriptions.get(key) ?? null;
  }

  async findStepConfig(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    stepName: string,
  ): Promise<SagaStepConfig | null> {
    const key = `${tenantId}:${organizationId}:${sagaType}:${stepName}`;
    return this.stepConfigs.get(key) ?? null;
  }

  async findCompensationConfigs(
    tenantId: string,
    organizationId: string,
    sagaType: string,
  ): Promise<SagaCompensationConfig[]> {
    const results: SagaCompensationConfig[] = [];
    for (const config of this.compensationConfigs.values()) {
      if (
        config.tenantId === tenantId &&
        config.organizationId === organizationId &&
        config.sagaType === sagaType
      ) {
        results.push(config);
      }
    }
    return results;
  }

  // ─── Test helpers ──────────────────────────────────────────────────

  addCompanyConfig(config: SagaCompanyConfig): void {
    const key = `${config.tenantId}:${config.organizationId}:${config.sagaType}`;
    this.companyConfigs.set(key, config);
  }

  addEventSubscription(sub: SagaEventSubscription): void {
    const key = `${sub.tenantId}:${sub.organizationId}:${sub.sagaType}:${sub.eventType}:${sub.eventVersion}`;
    this.eventSubscriptions.set(key, sub);
  }

  addStepConfig(config: SagaStepConfig): void {
    const key = `${config.tenantId}:${config.organizationId}:${config.sagaType}:${config.stepName}`;
    this.stepConfigs.set(key, config);
  }

  addCompensationConfig(config: SagaCompensationConfig): void {
    this.compensationConfigs.set(config.id, config);
  }

  getInstances(): SagaInstance[] {
    return [...this.instances.values()];
  }

  getStepExecutions(): SagaStepExecution[] {
    return [...this.stepExecutions.values()];
  }

  clear(): void {
    this.instances.clear();
    this.stepExecutions.clear();
    this.companyConfigs.clear();
    this.eventSubscriptions.clear();
    this.stepConfigs.clear();
    this.compensationConfigs.clear();
  }
}
