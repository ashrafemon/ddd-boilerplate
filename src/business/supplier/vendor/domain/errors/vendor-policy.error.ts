import { BusinessRuleViolationError } from '@business/shared-business/domain/domain.error';

export class VendorPolicyViolation extends BusinessRuleViolationError {
  constructor(message: string) {
    super(message);
  }
}
