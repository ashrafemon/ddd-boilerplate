import { GoodReceiptNote } from '../aggregates/grn.aggregate';

export abstract class GrnCommandRepository {
  abstract save(grn: GoodReceiptNote): Promise<GoodReceiptNote>;
  abstract update(grn: GoodReceiptNote): Promise<GoodReceiptNote>;
  abstract findById(id: string): Promise<GoodReceiptNote | null>;
  abstract findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null>;
  /** Reversal guard (plan Phase 4.1): at most one compensation per original. */
  abstract findByReversalOfId(reversalOfId: string): Promise<GoodReceiptNote | null>;
}
