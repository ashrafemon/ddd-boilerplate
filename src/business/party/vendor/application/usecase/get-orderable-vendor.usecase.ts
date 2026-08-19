import { Inject, Injectable } from '@nestjs/common';
import {
  VendorQueryRepositoryPort,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/domain-ports';

@Injectable()
export class GetOrderableVendorUseCase  {
  constructor(
    @Inject(VendorQueryRepositoryPort) private readonly vendorQueryRepo: VendorQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findOrderableById(id);
  }
}
