import { GrnReference } from '../contracts/grn.contracts';

export abstract class GrnForPurchaseOrderPort {
  abstract getGrn(id: string): Promise<GrnReference | null>;
}
