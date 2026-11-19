import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { resolveCompanyId } from '@platform/platform-common/context/company';
import { NextNumberOptions } from '../ports/numbering.port';
import { PrismaNumberSequenceRepository } from '../repositories/prisma-number-sequence.repository';
import { buildSequenceKey } from '../types/numbering.types';

/**
 * Use case: take the next number of one company's series.
 *
 * The series is scoped by the effective COMPANY — the same value the business
 * row is stamped with — so two companies each get their own `PO-00000001` and no
 * volume leaks across tenants. The scope is applied here, not by the caller, so
 * no caller can accidentally share a stream.
 */
@Injectable()
export class NextDocumentNumberUseCase {
  constructor(
    private readonly sequences: PrismaNumberSequenceRepository,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(sequenceKey: string, options: NextNumberOptions = {}): Promise<string> {
    const padding = options.padding ?? 0;
    const {
      prefix,
      padding: storedPadding,
      currentValue,
    } = await this.sequences.increment(
      buildSequenceKey(resolveCompanyId(this.requestContext.get()), sequenceKey),
      { prefix: options.prefix ?? '', padding },
    );

    // `currentValue` is a BIGINT column: format it as text and never route it
    // through `Number()`, which would silently lose precision past 2^53.
    const digits =
      storedPadding > 0
        ? currentValue.toString().padStart(storedPadding, '0')
        : currentValue.toString();
    return `${prefix}${digits}`;
  }
}
