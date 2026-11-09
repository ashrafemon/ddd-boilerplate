import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import './received-quantity.invariants';
export class ReceivedQuantity {
  private constructor(public readonly value: number) {}

  static create(value: number): ReceivedQuantity {
    invariantRegistry.enforce('received-quantity.create', { receivedQuantity: value });
    if (value <= 0) {
      throw new Error('Received quantity must be greater than zero');
    }
    return new ReceivedQuantity(value);
  }

  equals(other?: ReceivedQuantity): boolean {
    return !!other && this.value === other.value;
  }
}
