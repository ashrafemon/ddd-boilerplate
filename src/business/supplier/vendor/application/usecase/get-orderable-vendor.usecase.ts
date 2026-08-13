import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  VENDOR_QUERY_REPOSITORY,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class GetOrderableVendorUseCase implements QueryUseCase<string, VendorQueryRecord | null> {
  constructor(
    @Inject(VENDOR_QUERY_REPOSITORY) private readonly vendorQueryRepo: VendorQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findOrderableById(id);
  }
}
