import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';

import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorMapper } from '../../application/mappers/vendor.mapper';
import { Vendor } from '../../domain/aggregates/vendor.aggregate';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports/vendor-command-repository.port';
import { VendorCode } from '../../domain/value-objects/vendor.vos';

@Injectable()
export class PrismaVendorCommandRepository extends VendorCommandRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

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

  async findById(id: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { id } });
    return row ? VendorMapper.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findUnique({ where: { code } });
    return row ? VendorMapper.toDomain(row) : null;
  }
}
