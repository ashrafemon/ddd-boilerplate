import { Injectable } from '@nestjs/common';
import { ModulePortAccessor } from '../../../../../shared-kernel/ports/module-port-accessor';
import { GetVendorPort } from '../../../../vendor/application/port/get-vendor.port';
import {
  VendorLookupInput,
  VendorLookupOutput,
  VendorLookupPort,
} from '../../../domain/port/vendor-lookup.port';

/**
 * Bridge from the Purchase bounded context to the Vendor bounded context.
 *
 * Purchase owns the VendorLookupPort requirement. This adapter resolves the
 * Vendor module's public GetVendorPort through ModulePortAccessor and
 * translates between the two contracts. It never imports vendor use cases or
 * infrastructure directly.
 */
@Injectable()
export class VendorLookupAdapter implements VendorLookupPort {
  constructor(private readonly portAccessor: ModulePortAccessor) {}

  public async findForPurchase(input: VendorLookupInput): Promise<VendorLookupOutput> {
    const vendorPort = this.portAccessor.resolve(GetVendorPort);
    const vendor = await vendorPort.execute({ vendorId: input.vendorId });

    return {
      vendorId: vendor.id,
      code: vendor.code,
      name: vendor.name,
      status: vendor.status,
      isActive: vendor.status === 'ACTIVE',
    };
  }
}
