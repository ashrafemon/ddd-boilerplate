import { Injectable } from '@nestjs/common';
import { SagaInstanceRecord, SagaPlan } from '../types/saga.types';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { AdvanceSagaUseCase } from './advance-saga.usecase';

/** Everything `StartSagaUseCase` needs to open an instance. */
export interface StartSagaInput {
  tenantId: string;
  companyId: string;
  sagaKey: string;
  definitionId: string;
  configId: string | null;
  correlationKey: string;
  plan: SagaPlan;
  context: Record<string, unknown>;
  deadlineAt: Date | null;
}

/**
 * Use case: open the live instance for one correlation key and advance it.
 *
 * The insert is guarded by the live unique key, so a redelivered trigger starts
 * nothing (the existing instance is advanced by the WAIT routing instead). The
 * plan is frozen on the row: later definition edits never change a running saga.
 */
@Injectable()
export class StartSagaUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly advanceSaga: AdvanceSagaUseCase,
  ) {}

  async execute(input: StartSagaInput): Promise<SagaInstanceRecord | null> {
    const instance = await this.instances.tryInsertLive({
      tenantId: input.tenantId,
      companyId: input.companyId,
      sagaKey: input.sagaKey,
      definitionId: input.definitionId,
      configId: input.configId,
      rootRefType: null,
      rootRefId: null,
      correlationKey: input.correlationKey,
      plan: input.plan,
      context: input.context,
      deadlineAt: input.deadlineAt,
    });
    if (!instance) {
      return null;
    }
    return this.advanceSaga.execute(instance.id);
  }
}
