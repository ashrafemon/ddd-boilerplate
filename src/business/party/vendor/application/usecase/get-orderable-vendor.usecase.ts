import { Injectable } from '@nestjs/common';
import {
  VendorQueryRepositoryPort,
  VendorQueryRecord,
} from '../../domain/domain-ports';

@Injectable()
export class GetOrderableVendorUseCase {
  constructor(private readonly vendorQueryRepo: VendorQueryRepositoryPort) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findOrderableById(id);
  }
}
