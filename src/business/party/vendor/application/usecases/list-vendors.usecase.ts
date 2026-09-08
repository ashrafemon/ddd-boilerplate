import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorQuery } from '../../application/queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

@Injectable()
export class ListVendorsUseCase {
  constructor(private readonly vendorQueryRepo: VendorQuery) {}

  async execute(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return this.vendorQueryRepo.findAll(query);
  }
}
