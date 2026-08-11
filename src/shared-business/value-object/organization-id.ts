import { Identifier } from '../domain/identifier';

export class OrganizationId extends Identifier {
  public static from(value: string): OrganizationId {
    return new OrganizationId(value);
  }
}
