import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { JournalEntryId } from '../value-objects/journal-entry-id.vo';

export class JournalEntryRecorded extends DomainEvent {
  constructor(
    public readonly journalEntryId: JournalEntryId,
    public readonly entryNo: string,
    public readonly status: string,
  ) {
    super();
  }
}
