import { BusinessRuleViolationError } from '@business/shared-business/domain/domain.error';

export class ProductPolicyViolation extends BusinessRuleViolationError {
  constructor(message: string) {
    super(message);
  }
}
