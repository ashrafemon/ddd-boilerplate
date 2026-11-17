import { FailureMessage } from '@common/application/utils/failure-message';
export function isDuplicateJobError(err: unknown): boolean {
  const message = FailureMessage.of(err);
  return /already exists/i.test(message);
}
