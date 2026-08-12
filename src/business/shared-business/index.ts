import { DomainEvent } from './domain/bases/event.base';
import { AggregateRoot } from './domain/bases/aggregate.base';
import { Identifier } from './domain/identifier';
import { InvariantRegistry, invariantRegistry } from './domain/invariants/invariant.registry';
import { PolicyRegistry, policyRegistry } from './domain/policies/policy.registry';
import { DomainFactory } from './domain/factories/factory.base';
import { ModulePortResolver, MODULE_PORT_RESOLVER } from './ports/module-port-resolver.port';

export {
  AggregateRoot,
  DomainEvent,
  Identifier,
  InvariantRegistry,
  invariantRegistry,
  PolicyRegistry,
  policyRegistry,
  DomainFactory,
  ModulePortResolver,
  MODULE_PORT_RESOLVER,
};
