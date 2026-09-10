export abstract class ReconcileMissedJobsPort {
  /** Returns number of jobs reconciled (stale claims + missed firings). */
  abstract execute(): Promise<number>;
}
