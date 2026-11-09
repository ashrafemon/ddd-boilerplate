import { Injectable } from '@nestjs/common';

interface InvariantCheck<T> {
  name?: string;
  check: (context: T) => void;
}

@Injectable()
export class InvariantRegistry {
  private checks = new Map<string, (context: any) => void>();

  register<T>(key: string, check: InvariantCheck<T>): void {
    this.checks.set(key, check.check);
  }

  enforce<T>(key: string, context: T): void {
    const check = this.checks.get(key);
    if (check) {
      check(context);
    }
    // No-op if no check registered — invariants enforced by owning aggregate directly
  }
}

export const invariantRegistry = new InvariantRegistry();
