import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecases/get-orderable-vendor.usecase';
import { VendorForPurchasePort, VendorReference } from '@business/party/vendor/public';

@Injectable()
export class VendorForPurchaseFacade extends VendorForPurchasePort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}
