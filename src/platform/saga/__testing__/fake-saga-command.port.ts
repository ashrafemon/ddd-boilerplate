/* eslint-disable @typescript-eslint/require-await -- fake port: interface requires async, implementation is synchronous */
import { SagaCommandPort } from '../ports/saga-command.port';
import type { SagaCommandDispatchRequest, SagaCommandDispatchResult } from '../saga.types';

/**
 * Fake saga command port for unit tests.
 */
export class FakeSagaCommandPort implements SagaCommandPort {
  private dispatched: SagaCommandDispatchRequest[] = [];
  private result: SagaCommandDispatchResult = { success: true };

  async dispatch(request: SagaCommandDispatchRequest): Promise<SagaCommandDispatchResult> {
    this.dispatched.push(request);
    return this.result;
  }

  setResult(result: SagaCommandDispatchResult): void {
    this.result = result;
  }

  getDispatched(): readonly SagaCommandDispatchRequest[] {
    return this.dispatched;
  }

  clear(): void {
    this.dispatched = [];
    this.result = { success: true };
  }
}
