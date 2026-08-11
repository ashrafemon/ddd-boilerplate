import { DomainException } from './domain.exception';

export class UnauthorizedException extends DomainException {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedException';
  }
}
