import { UpdateScheduledJobInput } from '../scheduler.types';

export abstract class UpdateScheduledJobPort {
  abstract execute(input: UpdateScheduledJobInput): Promise<void>;
}
