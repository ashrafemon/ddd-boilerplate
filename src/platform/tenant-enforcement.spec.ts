import { NotFoundException } from '@nestjs/common';
import { InMemoryRequestContextService } from '@platform/context/__testing__/in-memory-request-context';
import { GetBatchOperationJobStatusUseCase } from './batch-operation/usecases/get-batch-operation-job-status.usecase';
import { BatchOperationJobRepositoryPort } from './batch-operation/ports/batch-operation-job-repository.port';
import { GetRecurringTemplateUseCase } from './recurring/usecases/get-recurring-template.usecase';
import { RecurringTemplateRepositoryPort } from './recurring/ports/recurring-template-repository.port';
import { GetScheduledJobStatusUseCase } from './scheduler/usecases/get-scheduled-job-status.usecase';
import { ScheduledJobRepositoryPort } from './scheduler/ports/scheduled-job-repository.port';

/**
 * SaaS isolation contract: every platform read/mutation must hide rows that
 * belong to another tenant as NotFound. One spec across the three services.
 */
describe('platform tenant enforcement', () => {
  it('batch get-status rejects foreign tenant jobs', async () => {
    const jobs = {
      findJob: jest.fn().mockResolvedValue({ id: 'j1', tenantId: 't2' }),
    } as unknown as BatchOperationJobRepositoryPort;
    const sut = new GetBatchOperationJobStatusUseCase(jobs, new InMemoryRequestContextService());
    await expect(sut.execute('j1', 't1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(sut.execute('j1', 't2')).resolves.toMatchObject({ id: 'j1' });
  });

  it('recurring get rejects foreign tenant templates', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({ id: 'r1', tenantId: 't2' }),
    } as unknown as RecurringTemplateRepositoryPort;
    const sut = new GetRecurringTemplateUseCase(repo, new InMemoryRequestContextService());
    await expect(sut.execute('r1', 't1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(sut.execute('r1', 't2')).resolves.toMatchObject({ id: 'r1' });
  });

  it('scheduler get rejects foreign tenant jobs', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({ id: 's1', tenantId: 't2' }),
    } as unknown as ScheduledJobRepositoryPort;
    const sut = new GetScheduledJobStatusUseCase(repo, new InMemoryRequestContextService());
    await expect(sut.execute('s1', 't1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(sut.execute('s1', 't2')).resolves.toMatchObject({ id: 's1' });
  });
});
