import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { NumberingPort } from './inbound/ports/numbering.port';
import { NumberingAdapter } from './inbound/adapters/numbering.adapter';
import { NumberSequenceRepositoryPort } from './outbound/ports/number-sequence.repository.port';
import { PrismaNumberSequenceRepository } from './outbound/adapters/prisma-number-sequence.repository';
import { NextDocumentNumberUseCase } from './use-cases/next-document-number.usecase';

/**
 * Platform Numbering module — company-scoped document series.
 *
 * NOT global. Callers inject `NumberingPort`; the company scope is applied by the
 * use case so every series is per company by construction.
 */
@Module({
  imports: [ContextModule],
  providers: [
    PrismaNumberSequenceRepository,
    { provide: NumberSequenceRepositoryPort, useExisting: PrismaNumberSequenceRepository },
    NextDocumentNumberUseCase,
    NumberingAdapter,
    { provide: NumberingPort, useExisting: NumberingAdapter },
  ],
  exports: [NumberingPort],
})
export class NumberingModule {}
