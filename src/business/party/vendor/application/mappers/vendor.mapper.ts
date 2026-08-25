import { VendorId } from '@business/shared-business';
import { Vendor } from '../../domain/aggregates';
import { VendorStatus } from '../../domain/types/vendor.enum';
import { VendorProps } from '../../domain/types/vendor.types';
import { VendorCode, VendorEmail, VendorName } from '../../domain/value-objects';

interface VendorRow {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class VendorMapper {
  static toDomain(row: VendorRow): Vendor {
    return Vendor.instantiate(
      VendorId.fromString(row.id),
      {
        code: VendorCode.create(row.code),
        name: VendorName.create(row.name),
        email: row.email ? VendorEmail.create(row.email) : null,
        phone: row.phone,
        address: row.address,
        status: row.status as VendorStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies VendorProps,
      row.version,
    );
  }

  static toRow(vendor: Vendor) {
    return {
      id: vendor.id.toString(),
      code: vendor.code,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      status: vendor.status,
      version: vendor.getVersion(),
    };
  }
}
