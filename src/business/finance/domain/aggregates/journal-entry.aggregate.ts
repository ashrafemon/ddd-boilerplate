import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { JournalEntryRecorded } from '../events/journal-entry-recorded.event';
import { JournalEntryProps } from '../types/finance.types';
import { JournalEntryStatus } from '../types/finance.enum';
import { JournalEntryId } from '../value-objects/journal-entry-id.vo';
import { JournalEntryInvariants } from './journal-entry.invariants';
import { JournalEntryPolicy } from '../policies/journal-entry.policy';

export class JournalEntry extends AggregateRoot<JournalEntryId> {
  private props: JournalEntryProps;

  private constructor(id: JournalEntryId, props: JournalEntryProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static instantiate(id: JournalEntryId, props: JournalEntryProps, version: number): JournalEntry {
    return new JournalEntry(id, props, version);
  }

  get entryNo(): string {
    return this.props.entryNo;
  }

  get reference(): string | null {
    return this.props.reference;
  }

  get postingDate(): Date {
    return this.props.postingDate;
  }

  get status(): JournalEntryStatus {
    return this.props.status;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get tenantId(): string | null {
    return this.props.tenantId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static record(input: {
    entryNo: string;
    reference?: string | null;
    postingDate: Date;
    companyId: string;
    tenantId: string | null;
  }): JournalEntry {
    const now = new Date();
    const journalEntry = JournalEntry.instantiate(
      JournalEntryId.generate(),
      {
        id: JournalEntryId.generate().toString(),
        entryNo: input.entryNo,
        reference: input.reference ?? null,
        postingDate: input.postingDate,
        status: JournalEntryStatus.DRAFT,
        companyId: input.companyId,
        tenantId: input.tenantId,
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      1,
    );

    journalEntry.addEvent(
      new JournalEntryRecorded(journalEntry.id, journalEntry.entryNo, journalEntry.status),
    );

    return journalEntry;
  }

  post(): void {
    JournalEntryInvariants.enforceJournalEntryStatusTransition(
      this.props.status,
      JournalEntryStatus.POSTED,
    );
    JournalEntryPolicy.enforceJournalEntryPostAllowed(
      this.props.status,
      this.props.accountingEntries?.length > 0,
    );

    this.props.status = JournalEntryStatus.POSTED;
    this.props.updatedAt = new Date();
    this.addEvent(new JournalEntryRecorded(this.id, this.props.entryNo, this.props.status));
  }

  reverse(): void {
    JournalEntryInvariants.enforceJournalEntryStatusTransition(
      this.props.status,
      JournalEntryStatus.REVERSED,
    );

    this.props.status = JournalEntryStatus.REVERSED;
    this.props.updatedAt = new Date();
    this.addEvent(new JournalEntryRecorded(this.id, this.props.entryNo, this.props.status));
  }
}
