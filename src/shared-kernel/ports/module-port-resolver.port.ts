/**
 * Resolves an outbound port to the concrete adapter that implements it, or a
 * remote use case class to the instance registered in the application
 * container.
 *
 * Cross-aggregate communication never imports another module. Instead the
 * consuming side resolves the target module's use case (or port token) through
 * this resolver (NestJS `ModuleRef` implementation) and calls it — the system
 * finds the provider. Adapters resolved this way must never call
 * infrastructure services; they delegate to use cases.
 */
export interface ModulePortResolver {
  resolvePort<TPort>(token: symbol | string | (abstract new (...args: never[]) => TPort)): TPort;
}

export const MODULE_PORT_RESOLVER = Symbol('MODULE_PORT_RESOLVER');
