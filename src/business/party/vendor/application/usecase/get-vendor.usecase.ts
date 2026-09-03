import { Injectable } from '@nestjs/common';
import {
  VendorQueryRepositoryPort,
} from '../../domain/domain-ports/vendor-query-repository.port';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

@Injectable()
export class GetVendorUseCase {
  constructor(private readonly vendorQueryRepo: VendorQueryRepositoryPort) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findById(id);
  }
}
