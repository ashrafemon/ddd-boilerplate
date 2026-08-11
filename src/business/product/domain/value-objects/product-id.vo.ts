import { Identifier } from '@business/shared-business/domain/identifier';

export class ProductId extends Identifier {
  static fromString(value: string): ProductId {
    return new ProductId(value);
  }

  static generate(): ProductId {
    return new ProductId(Identifier.create());
  }
}
