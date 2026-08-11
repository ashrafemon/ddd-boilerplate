import { Identifier } from '../domain/identifier';

export class UserId extends Identifier {
  public static from(value: string): UserId {
    return new UserId(value);
  }
}
