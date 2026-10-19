import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

@Injectable()
export class HasPurchaseOrderReceiptsUseCase {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async execute(purchaseOrderId: string): Promise<boolean> {
    const count = await this.txHost.tx.purchaseOrderLine.count({
      where: { purchaseOrderId, receivedQuantity: { gt: 0 } } as never,
    });
    return count > 0;
  }
}
