import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecases/get-orderable-vendor.usecase';
import { OrderableVendorQueryPort } from '@business/procurement/purchase-order/application/ports/outbound/vendor-query.port';
import { VendorReference } from '@business/party/vendor/public';

@Injectable()
export class OrderableVendorQueryAdapter extends OrderableVendorQueryPort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}
