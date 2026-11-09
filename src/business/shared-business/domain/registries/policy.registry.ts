import { Injectable } from '@nestjs/common';

interface PolicyEval<T> {
  name?: string;
  evaluate: (context: T) => boolean;
}

@Injectable()
export class PolicyRegistry {
  private policies = new Map<string, (context: any) => boolean>();

  register<T>(key: string, policy: PolicyEval<T>): void {
    this.policies.set(key, policy.evaluate);
  }

  evaluate<T>(key: string, context: T): boolean {
    const policy = this.policies.get(key);
    return policy ? policy(context) : true;
  }

  /** Alias matching old usage — delegates to evaluate */
  enforce<T>(key: string, context: T): void {
    this.evaluate(key, context);
  }
}

export const policyRegistry = new PolicyRegistry();
