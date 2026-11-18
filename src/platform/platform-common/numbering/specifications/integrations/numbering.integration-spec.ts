import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { Test, TestingModule } from '@nestjs/testing';
import { NextDocumentNumberUseCase } from '../../use-cases/next-document-number.usecase';
import { PrismaNumberSequenceRepository } from '../../outbound/adapters/prisma-number-sequence.repository';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

/**
 * Integration specification — document numbering against real Postgres.
 *
 * Proves what the unit tests cannot fake: the upsert-increment is atomic under
 * concurrency (no duplicate numbers), format is frozen when the series is first
 * created, and two companies never share a stream.
 */
describe('Document numbering (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaWriteService;
  let useCase: NextDocumentNumberUseCase;

  const companyA = `it-numbering-a-${randomUUID().slice(0, 8)}`;
  const companyB = `it-numbering-b-${randomUUID().slice(0, 8)}`;
  let company = companyA;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaWriteService);
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    const requestContext = { get: () => ({ companyId: company }) };
    useCase = new NextDocumentNumberUseCase(
      new PrismaNumberSequenceRepository(txHost),
      requestContext as unknown as RequestContextPort,
    );
  });

  afterAll(async () => {
    await prisma.numberSequence.deleteMany({
      where: { key: { contains: companyA.slice(0, 20) } },
    });
    await prisma.numberSequence.deleteMany({
      where: { key: { contains: companyB.slice(0, 20) } },
    });
    await moduleRef.close();
  });

  it('issues consecutive numbers from one series', async () => {
    const series = `it-so-${randomUUID()}`;

    await expect(useCase.execute(series, { prefix: 'SO-', padding: 4 })).resolves.toBe('SO-0001');
    await expect(useCase.execute(series, { prefix: 'SO-', padding: 4 })).resolves.toBe('SO-0002');
  });

  it('never issues the same number twice under concurrency', async () => {
    const series = `it-po-${randomUUID()}`;

    const numbers = await Promise.all(
      Array.from({ length: 10 }, () => useCase.execute(series, { prefix: 'PO-', padding: 6 })),
    );

    expect(new Set(numbers).size).toBe(10);
  });

  it('keeps the series format created by the first caller', async () => {
    const series = `it-inv-${randomUUID()}`;

    await useCase.execute(series, { prefix: 'INV-', padding: 6 });
    // A later caller asking for a different format must not rewrite the series.
    await expect(useCase.execute(series, { prefix: 'X-', padding: 1 })).resolves.toBe('INV-000002');
  });

  it('gives each company its own stream for the same sequence key', async () => {
    const series = `it-grn-${randomUUID()}`;

    company = companyA;
    const first = await useCase.execute(series, { prefix: 'GRN-', padding: 2 });
    company = companyB;
    const second = await useCase.execute(series, { prefix: 'GRN-', padding: 2 });

    expect(first).toBe('GRN-01');
    expect(second).toBe('GRN-01');
  });
});
