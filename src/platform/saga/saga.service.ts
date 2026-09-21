import { Injectable } from '@nestjs/common';
import { SagaPort } from './ports/saga.port';
import {
  StartSagaRequest,
  HandleSagaEventRequest,
  SuspendSagaRequest,
  CompensateSagaRequest,
  SagaInstance,
} from './saga.types';
import { StartSagaUseCase } from './usecases/start-saga.usecase';
import { HandleSagaEventUseCase } from './usecases/handle-saga-event.usecase';
import { SuspendSagaUseCase } from './usecases/suspend-saga.usecase';
import { CompensateSagaUseCase } from './usecases/compensate-saga.usecase';

/**
 * Saga service facade — the single entry point for all saga operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public SagaPort.
 */
@Injectable()
export class SagaService implements SagaPort {
  constructor(
    private readonly startSaga: StartSagaUseCase,
    private readonly handleSagaEvent: HandleSagaEventUseCase,
    private readonly suspendSaga: SuspendSagaUseCase,
    private readonly compensateSaga: CompensateSagaUseCase,
  ) {}

  async start(request: StartSagaRequest): Promise<SagaInstance> {
    return this.startSaga.execute(request);
  }

  async handleEvent(request: HandleSagaEventRequest): Promise<void> {
    return this.handleSagaEvent.execute(request);
  }

  async suspend(request: SuspendSagaRequest): Promise<void> {
    return this.suspendSaga.execute(request);
  }

  async compensate(request: CompensateSagaRequest): Promise<void> {
    return this.compensateSaga.execute(request);
  }
}
