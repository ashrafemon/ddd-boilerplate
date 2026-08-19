import { Inject, Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  VendorQueryRepositoryPort,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class ListVendorsUseCase > {
  constructor(
    @Inject(VendorQueryRepositoryPort) private readonly vendorQueryRepo: VendorQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    return this.vendorQueryRepo.findAll(query);
  }
}
