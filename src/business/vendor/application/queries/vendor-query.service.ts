import { Inject, Injectable } from '@nestjs/common';
import { VendorQueryPort, VendorSummary } from '../../ports/inbound/vendor.query.port';
import {
  VENDOR_REPOSITORY,
  VendorRepositoryPort,
} from '../../ports/outbound/vendor-repository.port';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';
import { PageQuery, PageResult, buildPageResult } from '@shared-kernal/types/pagination';
import { Vendor } from '../../domain/entities/vendor.aggregate';

function toSummary(vendor: Vendor): VendorSummary {
  return {
    id: vendor.id.toString(),
    code: vendor.code,
    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    status: vendor.status,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
}

@Injectable()
export class VendorQueryService implements VendorQueryPort {
  constructor(@Inject(VENDOR_REPOSITORY) private readonly vendorRepository: VendorRepositoryPort) {}

  async getVendor(id: VendorId): Promise<VendorSummary | null> {
    const vendor = await this.vendorRepository.findById(id);
    return vendor ? toSummary(vendor) : null;
  }

  async getOrderableVendor(id: VendorId): Promise<VendorSummary | null> {
    const vendor = await this.vendorRepository.findById(id);
    if (!vendor || !vendor.isOrderable()) {
      return null;
    }
    return toSummary(vendor);
  }

  async listVendors(query: PageQuery): Promise<PageResult<VendorSummary>> {
    const { items, total } = await this.vendorRepository.findAll(query);
    return buildPageResult(items.map(toSummary), total, query);
  }
}
