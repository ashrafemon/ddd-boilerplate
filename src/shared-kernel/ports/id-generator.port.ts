import { randomUUID } from 'crypto';

export abstract class IdGenerator {
  abstract nextId(): string;
}

export const UuidIdGenerator: IdGenerator = {
  nextId: () => randomUUID(),
};
