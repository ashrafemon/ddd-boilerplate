import { Identifier } from '../../../../../shared-business/domain/identifier';

export class ProductId extends Identifier {
  public static from(value: string): ProductId {
    return new ProductId(value);
  }
}
