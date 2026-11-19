import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { NumberingPort } from './ports/numbering.port';
import { NumberingAdapter } from './adapters/numbering.adapter';
import { PrismaNumberSequenceRepository } from './repositories/prisma-number-sequence.repository';
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
    NextDocumentNumberUseCase,
    NumberingAdapter,
    { provide: NumberingPort, useExisting: NumberingAdapter },
  ],
  exports: [NumberingPort],
})
export class NumberingModule {}
