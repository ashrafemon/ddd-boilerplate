import { RegisterScheduledJobInput } from '../scheduler.types';

/**
 * DI token (abstract class, per this repo's port convention). Implemented by
 * RegisterScheduledJobUseCase; bound in SchedulerModule.
 */
export abstract class RegisterScheduledJobPort {
  abstract execute(input: RegisterScheduledJobInput): Promise<string>;
}
