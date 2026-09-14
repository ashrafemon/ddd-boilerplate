import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { BatchOperationJobOutboxWriterPort } from '../ports/batch-operation-job-outbox-writer.port';
import { BatchOperationJobCompletedEvent } from '../events/batch-operation-job-completed.event';
import { BatchOperationJobRecord } from '../batch-operation.types';

@Injectable()
export class PrismaBatchOperationJobOutboxWriter implements BatchOperationJobOutboxWriterPort {
  constructor(private readonly outbox: OutboxWriterPort) {}

  async writeJobCompletedEvent(job: BatchOperationJobRecord): Promise<void> {
    await this.outbox.append(
      new BatchOperationJobCompletedEvent(
        job.id,
        job.jobNo,
        job.aggregateType,
        job.operationCode,
        job.status,
        job.totalRecords,
        job.successRecords,
        job.failedRecords,
        job.skippedRecords,
        job.tenantId,
      ),
      'BatchOperationJob',
      job.id,
    );
  }
}
