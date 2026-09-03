import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecase/get-orderable-vendor.usecase';
import { VendorQueryPort } from '../../public/ports/vendor.port';
import { OrderableVendorQueryPort } from '@business/procurement/purchase/application/ports/outbound/vendor-query.port';
import { VendorReference } from '../../public';

@Injectable()
export class VendorQueryFacade extends VendorQueryPort implements OrderableVendorQueryPort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}