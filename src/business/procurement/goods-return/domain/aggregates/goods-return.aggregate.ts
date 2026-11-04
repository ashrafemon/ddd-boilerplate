import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { GoodsReturnStatus } from '../types/goods-return.enum';

export interface GoodsReturnLine {
  grnLineId: string;
  productId: string;
  returnQuantity: number;
}

export class GoodsReturn extends AggregateRoot<string> {
  private constructor(
    id: string,
    public readonly goodsReceiptId: string,
    public readonly status: GoodsReturnStatus,
    public readonly lines: GoodsReturnLine[],
  ) {
    super(id);
  }

  static create(id: string, goodsReceiptId: string, lines: GoodsReturnLine[]): GoodsReturn {
    return new GoodsReturn(id, goodsReceiptId, GoodsReturnStatus.DRAFT, lines);
  }

  post(): GoodsReturn {
    return new GoodsReturn(this.id, this.goodsReceiptId, GoodsReturnStatus.POSTED, this.lines);
  }
}
