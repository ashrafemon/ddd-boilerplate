/**
 * Minimal Result monad for policy/invariant evaluation that can carry either
 * an ok payload or a failure reason without throwing.
 */
export type Result<T, E = string> = OkResult<T> | ErrResult<E>;

export class OkResult<T> {
  readonly ok = true as const;
  constructor(public readonly value: T) {}
}

export class ErrResult<E> {
  readonly ok = false as const;
  constructor(public readonly error: E) {}
}

export const ok = <T>(value: T): OkResult<T> => new OkResult(value);
export const fail = <E>(error: E): ErrResult<E> => new ErrResult(error);

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

export function isFail<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}
