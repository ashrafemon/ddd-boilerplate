import { VendorInvariants } from '../aggregates/vendor.invariants';
import '../aggregates/vendor.invariants';
import { VendorOrderabilityPolicy } from '../policies/orderability.policy';
import { VendorStatus } from '../types/vendor.types';
import { CreateVendorInput, VendorProps } from '../types/vendor.types';
import { VendorId } from '@business/party/vendor/domain/value-objects/vendor-id.vo';
import { VendorCode, VendorEmail, VendorName } from '../value-objects/vendor.vos';
import { VendorCodeInvariants } from '../value-objects/vendor-code.invariants';
import { VendorEmailInvariants } from '../value-objects/vendor-email.invariants';
import { VendorNameInvariants } from '../value-objects/vendor-name.invariants';

export class VendorFactory {
  static create(input: CreateVendorInput): Vendor {
    VendorInvariants.enforceVendorCreate(input.code, input.name, input.email);

    VendorCodeInvariants.enforceVendorCode(input.code);
    VendorNameInvariants.enforceVendorName(input.name);
    if (input.email) {
      VendorEmailInvariants.enforceVendorEmail(input.email);
    }

    const now = new Date();
    const vendor = Vendor.instantiate(
      VendorId.generate(),
      {
        code: VendorCode.create(input.code),
        name: VendorName.create(input.name),
        email: input.email ? VendorEmail.create(input.email) : null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        status: VendorStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      },
      1,
    );

    vendor.addEvent(new VendorCreated(vendor.id, vendor.code, vendor.name));
    return vendor;
  }

  static reconstitute(id: VendorId, props: VendorProps, version: number): Vendor {
    return Vendor.instantiate(id, props, version);
  }
}
