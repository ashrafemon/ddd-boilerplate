export abstract class RescheduleExternalJobPort {
  abstract execute(jobId: string, nextRunAt: Date): Promise<void>;
  abstract executeByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void>;
}
