import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecases/get-orderable-vendor.usecase';
import { FindOrderableVendorsByCodesUseCase } from '../usecases/find-orderable-vendors-by-codes.usecase';
import { VendorForPurchasePort } from '@business/party/vendor/public/ports/vendor-for-purchase.port';
import { VendorReference } from '@business/party/vendor/public/contracts/vendor-for-purchase.contract';

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
