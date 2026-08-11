/**
 * Application use case contract. Framework-independent: the only requirement
 * is an `execute(input)` method returning a promise.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface CommandHandler<Command, Result = void> {
  handle(command: Command): Promise<Result>;
}

export interface QueryHandler<Query, Result> {
  execute(query: Query): Promise<Result>;
}
