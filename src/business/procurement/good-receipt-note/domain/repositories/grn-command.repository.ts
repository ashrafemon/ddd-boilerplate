import { GoodReceiptNote } from '../aggregates/grn.aggregate';

export abstract class GrnCommandRepository {
  abstract save(grn: GoodReceiptNote): Promise<GoodReceiptNote>;
  abstract update(grn: GoodReceiptNote): Promise<GoodReceiptNote>;
  abstract findById(id: string): Promise<GoodReceiptNote | null>;
  abstract findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null>;
  abstract nextGrnSequence(): Promise<number>;
}
