import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
export function isDuplicateJobError(err: unknown): boolean {
  const message = FailureMessage.of(err);
  return /already exists/i.test(message);
}
