import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Vendor } from '../../domain/aggregates/vendor.aggregate';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorCode, VendorEmail, VendorName } from '../../domain/value-objects/vendor.vos';
import { VendorStatus } from '../../domain/types/vendor.enum';
import { VendorProps } from '../../domain/types/vendor.types';

@Injectable()
export class PrismaVendorCommandRepository extends VendorCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.create({ data: { ...this.toRow(vendor) } as never });
    return vendor;
  }

  async update(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.update({
      where: { id: vendor.id.toString() },
      data: { ...this.toRow(vendor) } as never,
    });
    return vendor;
  }

  async findById(id: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { code } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
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

  private toRow(vendor: Vendor) {
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
