import { DomainException } from '@common/application/exceptions/domain.exception';

export class InfrastructureException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INFRASTRUCTURE_ERROR', details);
    this.name = 'InfrastructureException';
  }
}
