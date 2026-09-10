import { Injectable } from '@nestjs/common';
import { RecurringExecutionPort } from '../ports/recurring-execution.port';
import {
  CompleteExecutionInput,
  RecurringExecutionRepositoryPort,
} from '../ports/recurring-execution-repository.port';
import { RecurringExecutionRecord } from '../recurring-template.types';

@Injectable()
export class RecurringExecutionFacade implements RecurringExecutionPort {
  constructor(private readonly executions: RecurringExecutionRepositoryPort) {}

  findById(id: string): Promise<RecurringExecutionRecord | null> {
    return this.executions.findById(id);
  }

  complete(id: string, input: CompleteExecutionInput): Promise<void> {
    return this.executions.complete(id, input);
  }

  fail(id: string, errorMessage: string): Promise<void> {
    return this.executions.fail(id, errorMessage);
  }
}
