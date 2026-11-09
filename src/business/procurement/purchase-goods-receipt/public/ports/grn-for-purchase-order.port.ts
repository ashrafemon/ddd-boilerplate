import { GrnReference } from '../contracts/grn-for-purchase-order.contract';

export abstract class GrnForPurchaseOrderPort {
  abstract getGrn(id: string): Promise<GrnReference | null>;
}
