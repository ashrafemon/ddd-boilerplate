import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SagaRepositoryPort } from '../ports/saga-repository.port';
import { SagaCommandPort } from '../ports/saga-command.port';
import { SagaDefinitionRegistry } from '../definitions/saga-definition';
import { StartSagaRequest, SagaInstance, SagaStatus } from '../saga.types';

/**
 * Use case: start a new saga instance from a trigger event.
 *
 * 1. Look up company configuration — if disabled, ignore
 * 2. Find saga definition — if not found, ignore
 * 3. Check event subscription — if disabled, ignore
 * 4. Create saga instance
 * 5. Execute first step (dispatch command)
 */
@Injectable()
export class StartSagaUseCase {
  private readonly logger = new Logger(StartSagaUseCase.name);

  constructor(
    private readonly repository: SagaRepositoryPort,
    private readonly commandPort: SagaCommandPort,
    private readonly definitionRegistry: SagaDefinitionRegistry,
  ) {}

  async execute(request: StartSagaRequest): Promise<SagaInstance> {
    const { tenantId, organizationId, sagaType, triggerEvent } = request;
    const sagaVersion = request.sagaVersion ?? 1;

    // 1. Check company configuration
    const companyConfig = await this.repository.findCompanyConfig(
      tenantId,
      organizationId,
      sagaType,
    );
    if (companyConfig && !companyConfig.enabled) {
      this.logger.debug(
        `Saga ${sagaType} disabled for ${tenantId}/${organizationId} — ignoring trigger`,
      );
      // Return a stub — caller should treat as no-op
      return this.createStubInstance(request);
    }

    // 2. Find saga definition
    const definition = this.definitionRegistry.get(sagaType, sagaVersion);
    if (!definition) {
      this.logger.warn(`No saga definition found for ${sagaType} v${sagaVersion}`);
      return this.createStubInstance(request);
    }

    // 3. Check event subscription
    const subscription = await this.repository.findEventSubscription(
      tenantId,
      organizationId,
      sagaType,
      triggerEvent.eventType,
      triggerEvent.eventVersion ?? 1,
    );
    if (subscription && !subscription.enabled) {
      this.logger.debug(
        `Event ${triggerEvent.eventType} disabled for saga ${sagaType} at ${tenantId}/${organizationId}`,
      );
      return this.createStubInstance(request);
    }

    // 4. Create saga instance
    const correlationId = request.correlationId ?? randomUUID();
    const claimToken = randomUUID();

    const instance = await this.repository.createInstance({
      tenantId,
      organizationId,
      sagaType,
      sagaVersion,
      correlationId,
      status: SagaStatus.RUNNING,
      currentStep: null,
      state: { triggerEvent },
      claimToken,
    });

    // 5. Execute first step
    await this.executeStep(instance, definition.steps[0]?.name ?? null, definition, request);

    return instance;
  }

  private async executeStep(
    instance: SagaInstance,
    stepName: string | null,
    definition: import('../saga.types').SagaDefinition,
    request: StartSagaRequest,
  ): Promise<void> {
    if (!stepName) {
      this.logger.debug(`Saga ${instance.sagaType} has no steps — marking complete`);
      await this.repository.updateInstanceStatus(
        instance.id,
        instance.claimToken!,
        instance.version,
        SagaStatus.COMPLETED,
        { completedAt: new Date() },
      );
      return;
    }

    const stepDef = definition.steps.find(s => s.name === stepName);
    if (!stepDef) {
      this.logger.warn(`Step ${stepName} not found in definition for ${instance.sagaType}`);
      return;
    }

    // Check step config
    const stepConfig = await this.repository.findStepConfig(
      instance.tenantId,
      instance.organizationId,
      instance.sagaType,
      stepName,
    );
    if (stepConfig && !stepConfig.enabled) {
      this.logger.debug(
        `Step ${stepName} disabled for ${instance.sagaType} at ${instance.tenantId}/${instance.organizationId}`,
      );
      return;
    }

    // Create step execution
    const stepClaimToken = randomUUID();
    await this.repository.createStepExecution({
      sagaInstanceId: instance.id,
      stepName,
      status: 'CLAIMED',
      claimToken: stepClaimToken,
    });

    // Update instance current step
    await this.repository.updateInstanceStatus(
      instance.id,
      instance.claimToken!,
      instance.version,
      SagaStatus.WAITING,
      { currentStep: stepName },
    );

    // Dispatch command
    const commandId = randomUUID();
    const result = await this.commandPort.dispatch({
      tenantId: instance.tenantId,
      organizationId: instance.organizationId,
      commandId,
      commandType: stepDef.commandType,
      commandVersion: stepDef.commandVersion,
      payload: request.triggerEvent.payload,
      correlationId: instance.correlationId,
      causationId: request.triggerEvent.eventId,
    });

    if (!result.success) {
      this.logger.error(`Command dispatch failed for step ${stepName}: ${result.error}`);
    }
  }

  private createStubInstance(request: StartSagaRequest): SagaInstance {
    const now = new Date();
    return {
      id: randomUUID(),
      tenantId: request.tenantId,
      organizationId: request.organizationId,
      sagaType: request.sagaType,
      sagaVersion: request.sagaVersion ?? 1,
      correlationId: request.correlationId ?? randomUUID(),
      status: SagaStatus.STARTED,
      currentStep: null,
      state: null,
      startedAt: now,
      completedAt: null,
      failedAt: null,
      lastError: null,
      claimToken: null,
      claimedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }
}
