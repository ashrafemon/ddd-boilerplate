import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ValidateActiveSagaDefinitionsUseCase } from '../use-cases/validate-active-saga-definitions.usecase';

/**
 * Boot-time integrity sweep for published saga definitions (flow step 9).
 *
 * Runs once the container is up, because action registration only exists after
 * bootstrap — that is the first moment "is this definition executable?" has an
 * honest answer. It never blocks startup: a database that is not reachable yet
 * logs a warning and the next deploy/restart re-runs the check.
 */
@Injectable()
export class SagaDefinitionIntegrityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SagaDefinitionIntegrityService.name);

  constructor(private readonly validateDefinitions: ValidateActiveSagaDefinitionsUseCase) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const { checked, invalidated } = await this.validateDefinitions.execute();
      if (invalidated.length > 0) {
        this.logger.error(
          `${invalidated.length} of ${checked} active saga definitions are INVALID and will not start new instances`,
        );
      }
    } catch (err) {
      this.logger.warn(`Saga definition integrity check skipped: ${(err as Error).message}`);
    }
  }
}
