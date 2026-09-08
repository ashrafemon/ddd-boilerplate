import { Injectable } from '@nestjs/common';
import { VendorQuery } from '../../application/queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

@Injectable()
export class GetVendorUseCase {
  constructor(private readonly vendorQueryRepo: VendorQuery) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findById(id);
  }
}
