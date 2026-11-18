import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaAuditLogRepository } from '../../outbound/adapters/prisma-audit-log.repository';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecordAuditEntryUseCase } from '../../use-cases/record-audit-entry.usecase';

/** Integration specification — the audit trail against real Postgres. */
describe('Audit trail (integration)', () => {
  const tenantId = 'it-audit-tenant';

  let moduleRef: TestingModule;
  let prisma: PrismaWriteService;
  let useCase: RecordAuditEntryUseCase;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaWriteService);
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    const requestContext = {
      get: () => ({ userId: 'user-it' }),
      getTenantId: () => tenantId,
      getCompanyId: () => 'it-audit-company',
      getRequestId: () => 'request-it',
      getCorrelationId: () => 'correlation-it',
    };
    useCase = new RecordAuditEntryUseCase(
      new PrismaAuditLogRepository(txHost),
      requestContext as unknown as RequestContextPort,
    );
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await moduleRef.close();
  });

  it('persists the resolved actor and scope', async () => {
    await useCase.execute({
      action: 'approve',
      entityType: 'PurchaseOrder',
      entityId: 'po-it-1',
      changes: { status: 'APPROVED', password: 'hunter2' },
    });

    const rows = await prisma.auditLog.findMany({ where: { entityId: 'po-it-1' } });

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.tenantId).toBe(tenantId);
    expect(row.companyId).toBe('it-audit-company');
    expect(row.actorId).toBe('user-it');
    expect(row.actorType).toBe('user');
    expect(row.requestId).toBe('request-it');
    expect(row.correlationId).toBe('correlation-it');
    expect(row.changes).toEqual({ status: 'APPROVED', password: '[redacted]' });
  });

  it('labels a context-less write as system', async () => {
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    const systemUseCase = new RecordAuditEntryUseCase(new PrismaAuditLogRepository(txHost), {
      get: () => null,
      getTenantId: () => tenantId,
      getCompanyId: () => 'it-audit-company',
      getRequestId: () => undefined,
      getCorrelationId: () => undefined,
    } as unknown as RequestContextPort);

    await systemUseCase.execute({
      action: 'purge',
      entityType: 'ImportJob',
      entityId: 'job-it-1',
    });

    const row = await prisma.auditLog.findFirst({ where: { entityId: 'job-it-1' } });
    expect(row?.actorType).toBe('system');
    expect(row?.actorId).toBeNull();
  });
});
