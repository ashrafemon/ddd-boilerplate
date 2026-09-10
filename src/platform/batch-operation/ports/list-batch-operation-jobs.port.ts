import { PageResult } from '@shared-kernel/types/pagination';
import { BatchOperationJobRecord, BatchOperationListQuery } from '../batch-operation.types';

/** Job history / list screen — headers only. */
export abstract class ListBatchOperationJobsPort {
  abstract execute(query: BatchOperationListQuery): Promise<PageResult<BatchOperationJobRecord>>;
}
