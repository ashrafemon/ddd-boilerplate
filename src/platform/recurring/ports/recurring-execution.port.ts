import { CompleteExecutionInput } from './recurring-execution-repository.port';
import { RecurringExecutionRecord } from '../recurring-template.types';

/**
 * Inbound port for completing a claimed Recurring execution from a business
 * consumer (e.g. after a RabbitMQ command created the document). DI token
 * (abstract class port), implemented by RecurringExecutionFacade.
 */
export abstract class RecurringExecutionPort {
  abstract findById(id: string): Promise<RecurringExecutionRecord | null>;
  abstract complete(id: string, input: CompleteExecutionInput): Promise<void>;
  abstract fail(id: string, errorMessage: string): Promise<void>;
}
