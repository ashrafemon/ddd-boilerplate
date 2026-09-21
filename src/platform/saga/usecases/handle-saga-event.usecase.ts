import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SagaRepositoryPort } from '../ports/saga-repository.port';
import { SagaCommandPort } from '../ports/saga-command.port';
import { SagaDefinitionRegistry } from '../definitions/saga-definition';
import { HandleSagaEventRequest, SagaStatus, SagaStepStatus } from '../saga.types';

/**
 * Use case: handle an incoming event for an existing saga instance.
 *
 * 1. Find saga instance by correlation
 * 2. Verify event matches current step's waitFor
 * 3. CAS mark step completed
 * 4. Find next step
 * 5. Execute next step (dispatch command)
 */
@Injectable()
export class HandleSagaEventUseCase {
  private readonly logger = new Logger(HandleSagaEventUseCase.name);

  constructor(
    private readonly repository: SagaRepositoryPort,
    private readonly commandPort: SagaCommandPort,
    private readonly definitionRegistry: SagaDefinitionRegistry,
  ) {}

  async execute(request: HandleSagaEventRequest): Promise<void> {
    const { tenantId, organizationId, sagaType, correlationId, event } = request;

    // 1. Find saga instance
    const instance = await this.repository.findInstanceByCorrelation(
      tenantId,
      organizationId,
      sagaType,
      correlationId,
    );
    if (!instance) {
      this.logger.debug(`No saga instance found for ${sagaType} with correlation ${correlationId}`);
      return;
    }

    if (instance.status !== SagaStatus.WAITING && instance.status !== SagaStatus.RUNNING) {
      this.logger.debug(
        `Saga ${instance.id} is in status ${instance.status} — ignoring event ${event.eventType}`,
      );
      return;
    }

    // 2. Find saga definition
    const definition = this.definitionRegistry.get(instance.sagaType, instance.sagaVersion);
    if (!definition) {
      this.logger.warn(`No definition found for ${instance.sagaType} v${instance.sagaVersion}`);
      return;
    }

    // 3. Find current step
    const currentStepName = instance.currentStep;
    if (!currentStepName) {
      this.logger.warn(`Saga ${instance.id} has no current step`);
      return;
    }

    const currentStepDef = definition.steps.find(s => s.name === currentStepName);
    if (!currentStepDef) {
      this.logger.warn(`Step ${currentStepName} not found in definition`);
      return;
    }

    // 4. Check event subscription
    const subscription = await this.repository.findEventSubscription(
      tenantId,
      organizationId,
      sagaType,
      event.eventType,
      event.eventVersion ?? 1,
    );
    if (subscription && !subscription.enabled) {
      this.logger.debug(
        `Event ${event.eventType} disabled for saga ${sagaType} at ${tenantId}/${organizationId}`,
      );
      return;
    }

    // 5. Verify event matches waitFor
    if (!currentStepDef.waitFor.includes(event.eventType)) {
      this.logger.debug(`Event ${event.eventType} not in waitFor for step ${currentStepName}`);
      return;
    }

    // 6. CAS mark step completed
    const stepExec = await this.repository.findStepExecution(instance.id, currentStepName);
    if (!stepExec) {
      this.logger.warn(`No step execution found for ${currentStepName} in saga ${instance.id}`);
      return;
    }

    const isFailureEvent = event.eventType.includes('Failed') || event.eventType.includes('Error');

    if (isFailureEvent) {
      // Mark step as failed
      await this.repository.updateStepStatus(
        stepExec.id,
        stepExec.claimToken!,
        stepExec.version,
        SagaStepStatus.FAILED,
        { completedAt: new Date(), lastError: `Event: ${event.eventType}` },
      );

      // Check for compensation
      const compensations = definition.compensation?.filter(c => c.on === currentStepName) ?? [];
      const compensationConfigs = await this.repository.findCompensationConfigs(
        tenantId,
        organizationId,
        sagaType,
      );
      const enabledCompensations = compensationConfigs.filter(c => c.enabled);

      if (enabledCompensations.length > 0 || compensations.length > 0) {
        // Start compensation
        await this.repository.updateInstanceStatus(
          instance.id,
          instance.claimToken!,
          instance.version,
          SagaStatus.COMPENSATING,
          { lastError: `Failed at step ${currentStepName}: ${event.eventType}` },
        );
      } else {
        // No compensation — suspend
        await this.repository.updateInstanceStatus(
          instance.id,
          instance.claimToken!,
          instance.version,
          SagaStatus.SUSPENDED,
          {
            lastError: `Failed at step ${currentStepName}: ${event.eventType}`,
            failedAt: new Date(),
          },
        );
      }
      return;
    }

    // 7. Mark step completed
    await this.repository.updateStepStatus(
      stepExec.id,
      stepExec.claimToken!,
      stepExec.version,
      SagaStepStatus.COMPLETED,
      { completedAt: new Date() },
    );

    // 8. Find next step
    const currentIndex = definition.steps.findIndex(s => s.name === currentStepName);
    const nextStep = definition.steps[currentIndex + 1];

    if (!nextStep) {
      // Saga complete
      await this.repository.updateInstanceStatus(
        instance.id,
        instance.claimToken!,
        instance.version,
        SagaStatus.COMPLETED,
        { completedAt: new Date(), currentStep: null },
      );
      this.logger.log(`Saga ${instance.id} (${instance.sagaType}) completed`);
      return;
    }

    // 9. Execute next step
    await this.executeNextStep(instance, nextStep.name, definition, event);
  }

  private async executeNextStep(
    instance: import('../saga.types').SagaInstance,
    stepName: string,
    definition: import('../saga.types').SagaDefinition,
    triggerEvent: { eventType: string; payload: unknown; eventId?: string },
  ): Promise<void> {
    const stepDef = definition.steps.find(s => s.name === stepName);
    if (!stepDef) return;

    // Check step config
    const stepConfig = await this.repository.findStepConfig(
      instance.tenantId,
      instance.organizationId,
      instance.sagaType,
      stepName,
    );
    if (stepConfig && !stepConfig.enabled) {
      this.logger.debug(`Step ${stepName} disabled — skipping`);
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

    // Update instance
    await this.repository.updateInstanceStatus(
      instance.id,
      instance.claimToken!,
      instance.version,
      SagaStatus.WAITING,
      { currentStep: stepName },
    );

    // Dispatch command
    const commandId = randomUUID();
    await this.commandPort.dispatch({
      tenantId: instance.tenantId,
      organizationId: instance.organizationId,
      commandId,
      commandType: stepDef.commandType,
      commandVersion: stepDef.commandVersion,
      payload: triggerEvent.payload,
      correlationId: instance.correlationId,
      causationId: triggerEvent.eventId,
    });
  }
}
