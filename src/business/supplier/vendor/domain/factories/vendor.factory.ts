import { DomainFactory } from '@business/shared-business/domain/factories';
import { invariantRegistry } from '@business/shared-business/domain/invariants';
import { Vendor, CreateVendorInput, VendorProps, VendorStatus } from '../entities';
import { VendorId } from '../value-objects';
import { VendorCode, VendorEmail, VendorName } from '../value-objects';
import { VendorCreated } from '../events';
import './../invariants/vendor.invariants';
import './../policies/vendor.policy';

/**
 * Vendor domain factory — single entry point for creating and rehydrating
 * Vendor aggregates. Enforces creation invariants and raises the VendorCreated
 * domain event.
 */
export class VendorFactory extends DomainFactory<Vendor, CreateVendorInput> {
  create(input: CreateVendorInput): Vendor {
    invariantRegistry.enforce('vendor.create', { code: input.code, name: input.name });

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

  reconstitute(id: VendorId, props: VendorProps, version: number): Vendor {
    return Vendor.instantiate(id, props, version);
  }
}

export const vendorFactory = new VendorFactory();
