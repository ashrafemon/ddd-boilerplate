import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecases/get-orderable-vendor.usecase';
import { FindOrderableVendorsByCodesUseCase } from '../usecases/find-orderable-vendors-by-codes.usecase';
import { VendorForPurchasePort, VendorReference } from '@business/party/vendor/public';

@Injectable()
export class VendorForPurchaseFacade extends VendorForPurchasePort {
  constructor(
    private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase,
    private readonly findOrderableVendorsByCodesUseCase: FindOrderableVendorsByCodesUseCase,
  ) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }

  findOrderableVendorsByCodes(codes: string[]): Promise<VendorReference[]> {
    return this.findOrderableVendorsByCodesUseCase.execute(codes);
  }
}
