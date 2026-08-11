import { DomainException } from './domain.exception';

export class ForbiddenException extends DomainException {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenException';
  }
}
