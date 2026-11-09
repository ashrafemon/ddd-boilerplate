import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export class PaymentCompleted extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly currency: string,
  ) {
    super();
  }
}
