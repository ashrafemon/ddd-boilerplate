import { Injectable } from '@nestjs/common';
import { GetGrnUseCase } from '../usecases/get-grn.usecase';
import {
  GrnForPurchaseOrderPort,
  GrnReference,
} from '@business/procurement/good-receipt-note/public';

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
