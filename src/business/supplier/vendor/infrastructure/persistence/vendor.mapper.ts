import {
  Vendor,
  VendorProps,
  VendorStatus,
} from '@business/supplier/vendor/domain/entities/vendor.aggregate';
import { VendorId } from '@business/supplier/vendor/domain/value-objects/vendor-id.vo';
import {
  VendorCode,
  VendorEmail,
  VendorName,
} from '@business/supplier/vendor/domain/value-objects/vendor.vos';

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
