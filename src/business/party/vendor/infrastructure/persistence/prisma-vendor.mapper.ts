import { Vendor } from '../../domain/aggregates/vendor.aggregate';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorCode, VendorEmail, VendorName } from '../../domain/value-objects/vendor.vos';
import { VendorStatus } from '../../domain/types/vendor.enum';
import { VendorQueryRecord } from '../../domain/types/vendor.types';
import { VendorProps } from '../../domain/types/vendor.types';

export class PrismaVendorMapper {
  static toDomain(row: {
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
  }): Vendor {
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

  static toRecord(row: never): VendorQueryRecord {
    const r = row as {
      id: string;
      code: string;
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      status: r.status as VendorStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
