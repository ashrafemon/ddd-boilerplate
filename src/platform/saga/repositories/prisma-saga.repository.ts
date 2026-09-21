import { Injectable } from '@nestjs/common';
import { PrismaWriteService } from '@infrastructure/database/prisma/prisma-write.service';
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
 * PostgreSQL-backed saga repository.
 *
 * - CAS updates with claim token + version for ownership validation
 * - FOR UPDATE SKIP LOCKED for step claiming
 * - Reconciliation of expired claims
 */
@Injectable()
export class PrismaSagaRepository implements SagaRepositoryPort {
  constructor(private readonly prisma: PrismaWriteService) {}

  // ─── Instance ──────────────────────────────────────────────────────

  async findInstanceById(id: string): Promise<SagaInstance | null> {
    const row = await this.prisma.sagaInstance.findUnique({ where: { id } });
    return row ? this.toInstance(row) : null;
  }

  async findInstanceByCorrelation(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    correlationId: string,
  ): Promise<SagaInstance | null> {
    const row = await this.prisma.sagaInstance.findFirst({
      where: { tenantId, organizationId, sagaType, correlationId },
    });
    return row ? this.toInstance(row) : null;
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
    const row = await this.prisma.sagaInstance.create({
      data: {
        tenantId: data.tenantId,
        organizationId: data.organizationId,
        sagaType: data.sagaType,
        sagaVersion: data.sagaVersion,
        correlationId: data.correlationId,
        status: data.status as never,
        currentStep: data.currentStep,
        state: JSON.parse(JSON.stringify(data.state ?? null)) as never,
        claimToken: data.claimToken,
        claimedAt: new Date(),
      },
    });
    return this.toInstance(row);
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
    const update: Record<string, unknown> = {
      status,
      version: { increment: 1 },
    };
    if (patch.currentStep !== undefined) update.currentStep = patch.currentStep;
    if (patch.state !== undefined) update.state = JSON.parse(JSON.stringify(patch.state)) as never;
    if (patch.lastError !== undefined) update.lastError = patch.lastError;
    if (patch.completedAt) update.completedAt = patch.completedAt;
    if (patch.failedAt) update.failedAt = patch.failedAt;

    const result = await this.prisma.sagaInstance.updateMany({
      where: { id, claimToken, version },
      data: update,
    });
    return result.count > 0;
  }

  // ─── Step Execution ────────────────────────────────────────────────

  async findStepExecution(
    sagaInstanceId: string,
    stepName: string,
  ): Promise<SagaStepExecution | null> {
    const row = await this.prisma.sagaStepExecution.findFirst({
      where: { sagaInstanceId, stepName },
    });
    return row ? this.toStepExecution(row) : null;
  }

  async createStepExecution(data: {
    sagaInstanceId: string;
    stepName: string;
    status: string;
    claimToken: string;
  }): Promise<SagaStepExecution> {
    const row = await this.prisma.sagaStepExecution.create({
      data: {
        sagaInstanceId: data.sagaInstanceId,
        stepName: data.stepName,
        status: data.status as never,
        claimToken: data.claimToken,
        claimedAt: new Date(),
      },
    });
    return this.toStepExecution(row);
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
    const update: Record<string, unknown> = {
      status,
      version: { increment: 1 },
    };
    if (patch.attempts !== undefined) update.attempts = patch.attempts;
    if (patch.commandId !== undefined) update.commandId = patch.commandId;
    if (patch.startedAt !== undefined) update.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) update.completedAt = patch.completedAt;
    if (patch.availableAt !== undefined) update.availableAt = patch.availableAt;
    if (patch.lastError !== undefined) update.lastError = patch.lastError;

    const result = await this.prisma.sagaStepExecution.updateMany({
      where: { id, claimToken, version },
      data: update,
    });
    return result.count > 0;
  }

  async releaseExpiredStepClaims(now: Date, claimLeaseMs: number): Promise<number> {
    const cutoff = new Date(now.getTime() - claimLeaseMs);
    const result = await this.prisma.sagaStepExecution.updateMany({
      where: {
        status: 'CLAIMED',
        claimedAt: { lt: cutoff },
      },
      data: {
        status: 'PENDING',
        claimToken: null,
        claimedAt: null,
        version: { increment: 1 },
      },
    });
    return result.count;
  }

  // ─── Company Configuration ─────────────────────────────────────────

  async findCompanyConfig(
    tenantId: string,
    organizationId: string,
    sagaType: string,
  ): Promise<SagaCompanyConfig | null> {
    const row = await this.prisma.sagaCompanyConfig.findFirst({
      where: { tenantId, organizationId, sagaType },
    });
    return row ? this.toCompanyConfig(row) : null;
  }

  async findEventSubscription(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    eventType: string,
    eventVersion: number,
  ): Promise<SagaEventSubscription | null> {
    const row = await this.prisma.sagaEventSubscription.findFirst({
      where: { tenantId, organizationId, sagaType, eventType, eventVersion },
    });
    return row ? this.toEventSubscription(row) : null;
  }

  async findStepConfig(
    tenantId: string,
    organizationId: string,
    sagaType: string,
    stepName: string,
  ): Promise<SagaStepConfig | null> {
    const row = await this.prisma.sagaStepConfig.findFirst({
      where: { tenantId, organizationId, sagaType, stepName },
    });
    return row ? this.toStepConfig(row) : null;
  }

  async findCompensationConfigs(
    tenantId: string,
    organizationId: string,
    sagaType: string,
  ): Promise<SagaCompensationConfig[]> {
    const rows = await this.prisma.sagaCompensationConfig.findMany({
      where: { tenantId, organizationId, sagaType },
      orderBy: { order: 'asc' },
    });
    return rows.map(r => this.toCompensationConfig(r));
  }

  // ─── Mappers ───────────────────────────────────────────────────────

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- Prisma raw row types: mapping to domain DTOs */
  private toInstance(row: any): SagaInstance {
    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      organizationId: row.organizationId as string,
      sagaType: row.sagaType as string,
      sagaVersion: row.sagaVersion as number,
      correlationId: row.correlationId as string,
      status: row.status as SagaInstance['status'],
      currentStep: row.currentStep as string | null,
      state: row.state as unknown,
      startedAt: row.startedAt as Date,
      completedAt: row.completedAt as Date | null,
      failedAt: row.failedAt as Date | null,
      lastError: row.lastError as string | null,
      claimToken: row.claimToken as string | null,
      claimedAt: row.claimedAt as Date | null,
      version: row.version as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  private toStepExecution(row: any): SagaStepExecution {
    return {
      id: row.id as string,
      sagaInstanceId: row.sagaInstanceId as string,
      stepName: row.stepName as string,
      status: row.status as SagaStepExecution['status'],
      attempts: row.attempts as number,
      commandId: row.commandId as string | null,
      startedAt: row.startedAt as Date | null,
      completedAt: row.completedAt as Date | null,
      availableAt: row.availableAt as Date | null,
      lastError: row.lastError as string | null,
      claimToken: row.claimToken as string | null,
      claimedAt: row.claimedAt as Date | null,
      version: row.version as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  private toCompanyConfig(row: any): SagaCompanyConfig {
    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      organizationId: row.organizationId as string,
      sagaType: row.sagaType as string,
      sagaVersion: row.sagaVersion as number,
      enabled: row.enabled as boolean,
      configJson: row.configJson as unknown,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  private toEventSubscription(row: any): SagaEventSubscription {
    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      organizationId: row.organizationId as string,
      sagaType: row.sagaType as string,
      eventType: row.eventType as string,
      eventVersion: row.eventVersion as number,
      enabled: row.enabled as boolean,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  private toStepConfig(row: any): SagaStepConfig {
    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      organizationId: row.organizationId as string,
      sagaType: row.sagaType as string,
      stepName: row.stepName as string,
      enabled: row.enabled as boolean,
      timeoutMs: row.timeoutMs as number | null,
      maxAttempts: row.maxAttempts as number | null,
      configJson: row.configJson as unknown,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  private toCompensationConfig(row: any): SagaCompensationConfig {
    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      organizationId: row.organizationId as string,
      sagaType: row.sagaType as string,
      failedStep: row.failedStep as string,
      compensationStep: row.compensationStep as string,
      order: row.order as number,
      enabled: row.enabled as boolean,
      configJson: row.configJson as unknown,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
}
