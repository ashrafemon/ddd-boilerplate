export abstract class DispatchDueJobsPort {
  /** Dispatches due jobs in LIMIT-sized batches until empty or time budget exhausted. Returns count dispatched. */
  abstract execute(options?: { batchSize?: number; timeBudgetMs?: number }): Promise<number>;
}
