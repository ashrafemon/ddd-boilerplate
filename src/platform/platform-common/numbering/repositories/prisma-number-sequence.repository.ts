import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * PostgreSQL adapter for `document_number_sequences`.
 *
 * Runs through the TransactionHost so numbering participates in the caller's
 * `@Transactional()` boundary (or the fallback client when called standalone):
 * a rolled-back document must not burn a number.
 */
@Injectable()
export class PrismaNumberSequenceRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async increment(
    sequenceKey: string,
    defaults: { prefix: string; padding: number },
  ): Promise<{ prefix: string; padding: number; currentValue: bigint }> {
    const row = await this.txHost.tx.numberSequence.upsert({
      where: { key: sequenceKey },
      create: {
        key: sequenceKey,
        prefix: defaults.prefix,
        padding: defaults.padding,
        currentValue: 1,
      },
      // `prefix`/`padding` are fixed when the series is created; a later caller
      // must not silently change the format of numbers already issued.
      update: { currentValue: { increment: 1 } },
      select: { prefix: true, padding: true, currentValue: true },
    });
    return row;
  }
}
