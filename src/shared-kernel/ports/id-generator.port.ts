import { randomUUID } from 'crypto';

export interface IdGenerator {
  nextId(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export const UuidIdGenerator: IdGenerator = {
  nextId: () => randomUUID(),
};
