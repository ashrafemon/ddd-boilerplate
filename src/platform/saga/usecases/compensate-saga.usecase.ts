import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SagaRepositoryPort } from '../ports/saga-repository.port';
import { SagaCommandPort } from '../ports/saga-command.port';
import { SagaDefinitionRegistry } from '../definitions/saga-definition';
import { CompensateSagaRequest, SagaStatus } from '../saga.types';

/**
 * Use case: trigger compensation for a failed saga step.
 *
 * 1. Find saga instance
 * 2. Find compensation definition for the failed step
 * 3. Dispatch compensation command
 * 4. Mark instance as COMPENSATING
 */
@Injectable()
export class CompensateSagaUseCase {
  private readonly logger = new Logger(CompensateSagaUseCase.name);

  constructor(
    private readonly repository: SagaRepositoryPort,
    private readonly commandPort: SagaCommandPort,
    private readonly definitionRegistry: SagaDefinitionRegistry,
  ) {}

  async execute(request: CompensateSagaRequest): Promise<void> {
    const instance = await this.repository.findInstanceById(request.sagaInstanceId);
    if (!instance) {
      this.logger.warn(`Saga instance ${request.sagaInstanceId} not found`);
      return;
    }

    const definition = this.definitionRegistry.get(instance.sagaType, instance.sagaVersion);
    if (!definition) {
      this.logger.warn(`No definition for ${instance.sagaType} v${instance.sagaVersion}`);
      return;
    }

    // Find compensation for the failed step
    const compensations = definition.compensation?.filter(c => c.on === request.failedStep) ?? [];
    if (compensations.length === 0) {
      this.logger.debug(`No compensation defined for step ${request.failedStep}`);
      // Mark as compensated (nothing to do)
      await this.repository.updateInstanceStatus(
        instance.id,
        request.claimToken,
        instance.version,
        SagaStatus.COMPENSATED,
        { completedAt: new Date() },
      );
      return;
    }

    // Mark as compensating
    await this.repository.updateInstanceStatus(
      instance.id,
      request.claimToken,
      instance.version,
      SagaStatus.COMPENSATING,
      {},
    );

    // Dispatch first compensation command
    const comp = compensations[0];
    const commandId = randomUUID();
    const result = await this.commandPort.dispatch({
      tenantId: instance.tenantId,
      organizationId: instance.organizationId,
      commandId,
      commandType: comp.commandType,
      commandVersion: comp.commandVersion,
      payload: instance.state ?? {},
      correlationId: instance.correlationId,
    });

    if (!result.success) {
      this.logger.error(
        `Compensation command dispatch failed for ${comp.commandType}: ${result.error}`,
      );
      await this.repository.updateInstanceStatus(
        instance.id,
        request.claimToken,
        instance.version,
        SagaStatus.SUSPENDED,
        { lastError: `Compensation failed: ${result.error}` },
      );
    }
  }
}
