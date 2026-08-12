import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Vendor } from '@business/supplier/vendor/domain/entities/vendor.aggregate';
import { VendorId } from '@business/supplier/vendor/domain/value-objects/vendor-id.vo';
import { VendorCode } from '@business/supplier/vendor/domain/value-objects/vendor.vos';
import { VendorCommandRepositoryPort } from '@business/supplier/vendor/ports/outbound/vendor-command-repository.port';
import { VendorMapper } from './vendor.mapper';

@Injectable()
export class PrismaVendorCommandRepository implements VendorCommandRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async save(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.create({ data: { ...VendorMapper.toRow(vendor) } as never });
    return vendor;
  }

  async update(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.update({
      where: { id: vendor.id.toString() },
      data: { ...VendorMapper.toRow(vendor) } as never,
    });
    return vendor;
  }

  async findById(id: VendorId): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { id: id.toString() } });
    return row ? VendorMapper.toDomain(row) : null;
  }

  async findByCode(code: VendorCode): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { code: code.value } });
    return row ? VendorMapper.toDomain(row) : null;
  }
}
