import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorQueryRepositoryPort } from '../../domain/domain-ports';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

@Injectable()
export class ListVendorsUseCase {
  constructor(private readonly vendorQueryRepo: VendorQueryRepositoryPort) {}

  async execute(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return this.vendorQueryRepo.findAll(query);
  }
}
