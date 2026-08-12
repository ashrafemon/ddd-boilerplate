import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  VENDOR_QUERY_REPOSITORY,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/ports/vendor-query-repository.port';

@Injectable()
export class ListVendorsUseCase implements QueryUseCase<PageQuery, PageResult<VendorQueryRecord>> {
  constructor(
    @Inject(VENDOR_QUERY_REPOSITORY) private readonly vendorQueryRepo: VendorQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return this.vendorQueryRepo.findAll(query);
  }
}
