import { Injectable, Logger } from '@nestjs/common';
import { SagaRepositoryPort } from '../ports/saga-repository.port';
import { SuspendSagaRequest, SagaStatus } from '../saga.types';

/**
 * Use case: suspend a running saga instance.
 *
 * CAS update: status → SUSPENDED with claim token + version.
 */
@Injectable()
export class SuspendSagaUseCase {
  private readonly logger = new Logger(SuspendSagaUseCase.name);

  constructor(private readonly repository: SagaRepositoryPort) {}

  async execute(request: SuspendSagaRequest): Promise<void> {
    const instance = await this.repository.findInstanceById(request.sagaInstanceId);
    if (!instance) {
      this.logger.warn(`Saga instance ${request.sagaInstanceId} not found`);
      return;
    }

    const success = await this.repository.updateInstanceStatus(
      instance.id,
      request.claimToken,
      instance.version,
      SagaStatus.SUSPENDED,
      { lastError: request.reason ?? 'Manually suspended', failedAt: new Date() },
    );

    if (!success) {
      this.logger.warn(`Suspend failed for saga ${instance.id} — ownership lost`);
    }
  }
}
