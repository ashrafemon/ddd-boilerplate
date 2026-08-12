/**
 * Application use case contracts. Framework-independent: the only requirement
 * is an `execute(input)` method returning a promise.
 *
 * Use cases are split into commands and queries:
 * - Commands mutate state, call the domain (aggregates/entities/factories) and
 *   run inside a `@Transactional` boundary.
 * - Queries are read-only, skip the domain entirely and go straight to the
 *   query repository (read model / Prisma read replica).
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

/**
 * State-changing use case. Runs inside a transaction and orchestrates:
 * company config port -> domain factory/aggregate -> command repository ->
 * outbox (persist events) -> in-process event bus.
 */
export type CommandUseCase<Command, Result> = UseCase<Command, Result>;

/**
 * Read-only use case. Skips the domain and the outbox; delegates to the query
 * repository which injects the Prisma read service.
 */
export type QueryUseCase<Query, Result> = UseCase<Query, Result>;

export interface CommandHandler<Command, Result = void> {
  handle(command: Command): Promise<Result>;
}

export interface QueryHandler<Query, Result> {
  execute(query: Query): Promise<Result>;
}
