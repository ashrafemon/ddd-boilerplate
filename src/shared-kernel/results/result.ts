/**
 * Simple functional Result type used inside application/domain code to avoid
 * exception-based control flow where a value-oriented API is cleaner.
 */
export type Result<TValue = void, TError = Error> =
  | { ok: true; value: TValue }
  | { ok: false; error: TError };

export function ok<TValue = void>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function fail<TError = Error>(error: TError): Result<never, TError> {
  return { ok: false, error };
}

export function isOk<TValue, TError>(result: Result<TValue, TError>): result is { ok: true; value: TValue } {
  return result.ok;
}

export function isFail<TValue, TError>(result: Result<TValue, TError>): result is { ok: false; error: TError } {
  return !result.ok;
}
