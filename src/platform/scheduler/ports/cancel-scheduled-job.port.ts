export abstract class CancelScheduledJobPort {
  abstract execute(jobId: string): Promise<void>;
  abstract executeByAggregate(aggregateType: string, aggregateId: string): Promise<void>;
}
