import { Identifier } from '../domain/identifier';
import { createUuid } from '../../shared-kernel/utilities/uuid';

export class TenantId extends Identifier {
  public static from(value: string): TenantId {
    return new TenantId(value);
  }

  public static create(): TenantId {
    return new TenantId(createUuid());
  }
}
