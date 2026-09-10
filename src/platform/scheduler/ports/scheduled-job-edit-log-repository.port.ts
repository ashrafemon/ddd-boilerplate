export interface InsertEditLogInput {
  scheduledJobId: string;
  editedBy?: string | null;
  changedFields: Record<string, unknown>;
}

/** DI token (abstract class port). Implemented by PrismaScheduledJobEditLogRepository. */
export abstract class ScheduledJobEditLogRepositoryPort {
  abstract insert(input: InsertEditLogInput): Promise<void>;
}
