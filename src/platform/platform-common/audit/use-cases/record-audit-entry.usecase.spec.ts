import { RecordAuditEntryUseCase } from './record-audit-entry.usecase';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AuditLogRecord } from '../types/audit.types';

describe('RecordAuditEntryUseCase', () => {
  function makeSut(context: Record<string, unknown> | null = { userId: 'user-1' }) {
    const auditLogs = {
      append: jest.fn<Promise<void>, [AuditLogRecord]>(async () => undefined),
    };
    const requestContext = {
      get: jest.fn(() => context),
      getTenantId: jest.fn(() => 'tenant-1'),
      getCompanyId: jest.fn(() => 'company-1'),
      getRequestId: jest.fn(() => 'request-1'),
      getCorrelationId: jest.fn(() => 'correlation-1'),
    };
    const useCase = new RecordAuditEntryUseCase(
      auditLogs,
      requestContext as unknown as RequestContextPort,
    );
    return { useCase, auditLogs, requestContext };
  }

  it('fills actor and scope from the request context', async () => {
    const { useCase, auditLogs } = makeSut();

    await useCase.execute({ action: 'approve', entityType: 'PurchaseOrder', entityId: 'po-1' });

    expect(auditLogs.append.mock.calls[0][0]).toEqual({
      action: 'approve',
      entityType: 'PurchaseOrder',
      entityId: 'po-1',
      changes: undefined,
      actorId: 'user-1',
      actorType: 'user',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      requestId: 'request-1',
      correlationId: 'correlation-1',
    });
  });

  it('labels a change with no authenticated actor as system', async () => {
    const { useCase, auditLogs } = makeSut(null);

    await useCase.execute({ action: 'purge', entityType: 'ImportJob', entityId: 'job-1' });

    const record = auditLogs.append.mock.calls[0][0];
    expect(record.actorId).toBeUndefined();
    expect(record.actorType).toBe('system');
  });

  it('never lets a caller override the request id or correlation id', async () => {
    const { useCase, auditLogs } = makeSut();

    await useCase.execute({
      action: 'cancel',
      entityType: 'Invoice',
      entityId: 'inv-1',
      // @ts-expect-error — these are context-owned, not caller-owned fields
      requestId: 'forged',
      correlationId: 'forged',
    });

    const record = auditLogs.append.mock.calls[0][0];
    expect(record.requestId).toBe('request-1');
    expect(record.correlationId).toBe('correlation-1');
  });

  it('redacts credential-shaped change fields before persisting', async () => {
    const { useCase, auditLogs } = makeSut();

    await useCase.execute({
      action: 'reset-credentials',
      entityType: 'User',
      entityId: 'user-1',
      changes: { password: 'hunter2', status: 'ACTIVE' },
    });

    expect(auditLogs.append.mock.calls[0][0].changes).toEqual({
      password: '[redacted]',
      status: 'ACTIVE',
    });
  });

  it('honours explicit tenant/company/actor overrides', async () => {
    const { useCase, auditLogs } = makeSut();

    await useCase.execute({
      action: 'import',
      entityType: 'Product',
      entityId: 'p-1',
      tenantId: 'tenant-2',
      companyId: 'company-2',
      actorId: 'integration',
      actorType: 'service',
    });

    const record = auditLogs.append.mock.calls[0][0];
    expect(record.tenantId).toBe('tenant-2');
    expect(record.companyId).toBe('company-2');
    expect(record.actorId).toBe('integration');
    expect(record.actorType).toBe('service');
  });
});
