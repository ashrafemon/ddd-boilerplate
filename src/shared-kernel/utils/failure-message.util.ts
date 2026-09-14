/** One audited conversion from an unknown throw-cause to a log/error string. */
export class FailureMessage {
  static of(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
