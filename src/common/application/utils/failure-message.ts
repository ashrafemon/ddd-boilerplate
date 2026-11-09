export class FailureMessage {
  static of(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
