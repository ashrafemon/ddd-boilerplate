import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  VendorQueryRepositoryPort,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class ListVendorsUseCase implements QueryUseCase<PageQuery, PageResult<VendorQueryRecord>> {
  constructor(
    @Inject(VendorQueryRepositoryPort) private readonly vendorQueryRepo: VendorQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return this.vendorQueryRepo.findAll(query);
  }
}
