import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Vendor } from '../../domain/aggregates/vendor.aggregate';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorCode, VendorEmail, VendorName } from '../../domain/value-objects/vendor.vos';
import { VendorStatus } from '../../domain/types/vendor.enum';
import { PrismaVendorCommandMapper } from './prisma-vendor.mapper';

@Injectable()
export class PrismaVendorCommandRepository extends VendorCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.create({ data: { ...PrismaVendorCommandMapper.toRow(vendor) } as never });
    return vendor;
  }

  async update(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.update({
      where: { id: vendor.id.toString() },
      data: { ...PrismaVendorCommandMapper.toRow(vendor) } as never,
    });
    return vendor;
  }

  async findById(id: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { id } });
    return row ? PrismaVendorCommandMapper.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { code } });
    return row ? PrismaVendorCommandMapper.toDomain(row) : null;
  }
}
