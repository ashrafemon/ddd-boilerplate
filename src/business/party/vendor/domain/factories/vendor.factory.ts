import { DomainFactory } from '@business/shared-business/domain/bases/factory.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { Vendor } from '../aggregates';
import '../aggregates/vendor.invariants';
import { VendorCreated } from '../domain-events';
import '../domain-policies/vendor.policy';
import { VendorStatus } from '../types/vendor.enum';
import { CreateVendorInput, VendorProps } from '../types/vendor.types';
import { VendorCode, VendorEmail, VendorId, VendorName } from '../value-objects';
import '../value-objects/vendor-code.invariants';
import '../value-objects/vendor-email.invariants';
import '../value-objects/vendor-name.invariants';

/**
 * Vendor domain factory — single entry point for creating and rehydrating
 * Vendor aggregates. Enforces creation invariants and raises the VendorCreated
 * domain event.
 */
export class VendorFactory extends DomainFactory<Vendor, CreateVendorInput> {
  create(input: CreateVendorInput): Vendor {
    invariantRegistry.enforce('vendor.create', {
      code: input.code,
      name: input.name,
      email: input.email,
    });

    invariantRegistry.enforce('vendor-code.create', { code: input.code });
    invariantRegistry.enforce('vendor-name.create', { name: input.name });
    if (input.email) {
      invariantRegistry.enforce('vendor-email.create', { email: input.email });
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

  reconstitute(id: VendorId, props: VendorProps, version: number): Vendor {
    return Vendor.instantiate(id, props, version);
  }
}

export const vendorFactory = new VendorFactory();
