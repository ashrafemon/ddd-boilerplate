import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { NextNumberOptions, NumberingPort } from './ports/numbering.port';

/**
 * Sequence-backed document numbering. All DB access goes through the
 * TransactionHost so it participates in the caller's @Transactional boundary
 * (or the fallback client when called standalone).
 */
@Injectable()
export class PrismaNumberingService implements NumberingPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  public async nextNumber(sequenceKey: string, options: NextNumberOptions = {}): Promise<string> {
    const padding = options.padding ?? 0;

    const updated = await this.txHost.tx.numberSequence.upsert({
      where: { key: sequenceKey },
      create: {
        key: sequenceKey,
        prefix: options.prefix ?? '',
        padding,
        currentValue: 1,
      },
      // Single statement: no read-then-write window, so two callers racing on a
      // brand-new key cannot both insert it. `prefix`/`padding` are fixed when
      // the sequence is first created; later calls must not silently change them.
      update: { currentValue: { increment: 1 } },
    });

    const numberText =
      padding > 0
        ? updated.currentValue.toString().padStart(padding, '0')
        : updated.currentValue.toString();

    return `${updated.prefix}${numberText}`;
  }
}
