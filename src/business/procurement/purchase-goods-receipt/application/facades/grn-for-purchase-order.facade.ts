import { Injectable } from '@nestjs/common';
import { GetGrnUseCase } from '../use-cases/get-grn.usecase';
import { GrnForPurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/public/ports/grn-for-purchase-order.port';
import { GrnReference } from '@business/procurement/purchase-goods-receipt/public/contracts/grn-for-purchase-order.contract';

/**
 * GRN module's query facade exposed to PurchaseOrder. Lives in the GRN module
 * because it adapts the GRN use case to the consuming module's contract.
 */
@Injectable()
export class GrnForPurchaseOrderFacade extends GrnForPurchaseOrderPort {
  constructor(private readonly getGrnUseCase: GetGrnUseCase) {
    super();
  }

  getGrn(id: string): Promise<GrnReference | null> {
    return this.getGrnUseCase.execute(id);
  }
}
