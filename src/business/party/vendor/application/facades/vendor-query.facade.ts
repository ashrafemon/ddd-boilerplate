import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecase';
import { VendorQueryPort } from '../../public/ports/vendor.port';
import { OrderableVendorQueryPort } from '@business/procurement/purchase';
import { VendorReference } from '../../public/contracts/vendor.contracts';

@Injectable()
export class VendorQueryFacade extends VendorQueryPort implements OrderableVendorQueryPort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}