import { Injectable } from '@nestjs/common';
import { VendorQuery } from '../../application/queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

@Injectable()
export class FindOrderableVendorsByCodesUseCase {
  constructor(private readonly vendorQueryRepo: VendorQuery) {}

  execute(codes: string[]): Promise<VendorQueryRecord[]> {
    return this.vendorQueryRepo.findOrderableByCodes(codes);
  }
}
