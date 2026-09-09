import { Injectable } from '@nestjs/common';
import { GetOrderableVendorUseCase } from '../usecases/get-orderable-vendor.usecase';
import { OrderableVendorPort } from '@business/procurement/purchase-order/application/outbound-ports/vendor-query.port';
import { VendorReference } from '@business/party/vendor/public';

@Injectable()
export class OrderableVendorQueryAdapter extends OrderableVendorPort {
  constructor(private readonly getOrderableVendorUseCase: GetOrderableVendorUseCase) {
    super();
  }

  getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.getOrderableVendorUseCase.execute(id);
  }
}
