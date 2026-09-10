import { ImportJobRecord } from '../import.types';

export abstract class ImportJobOutboxWriterPort {
  abstract writeCompletedEvent(job: ImportJobRecord): Promise<void>;
  abstract writeFailedEvent(job: ImportJobRecord): Promise<void>;
  abstract writeCancelledEvent(job: ImportJobRecord): Promise<void>;
}
