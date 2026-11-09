import { Injectable, NotFoundException } from '@nestjs/common';
import { VendorQuery } from '../../application/queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

@Injectable()
export class GetVendorUseCase {
  constructor(private readonly vendorQueryRepo: VendorQuery) {}

  async execute(id: string): Promise<VendorQueryRecord> {
    const record = await this.vendorQueryRepo.findById(id);
    if (!record) {
      throw new NotFoundException('Vendor not found');
    }
    return record;
  }
}
