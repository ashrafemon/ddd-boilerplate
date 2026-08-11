import { EntityNotFoundException } from './entity-not-found.exception';

export class AggregateNotFoundException extends EntityNotFoundException {
  constructor(aggregateName: string, id?: string | number) {
    super(`${aggregateName} aggregate`, id);
    this.name = 'AggregateNotFoundException';
  }
}
