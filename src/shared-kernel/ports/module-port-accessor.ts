export type AbstractPortType<TPort> = abstract new (...args: unknown[]) => TPort;

/**
 * Abstraction over NestJS's ModuleRef used to resolve application ports of
 * other modules.
 *
 * Business/application code must NEVER use ModuleRef directly. It depends only
 * on this abstraction. The infrastructure implementation delegates to
 * ModuleRef with `strict: false` so cross-module lookups resolve lazily.
 */
export abstract class ModulePortAccessor {
  public abstract resolve<TPort extends object>(port: AbstractPortType<TPort>): TPort;
}
