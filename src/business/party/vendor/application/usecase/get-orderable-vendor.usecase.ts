import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  VendorQueryRepositoryPort,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/domain-ports';

@Injectable()
export class GetOrderableVendorUseCase implements QueryUseCase<string, VendorQueryRecord | null> {
  constructor(
    @Inject(VendorQueryRepositoryPort) private readonly vendorQueryRepo: VendorQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findOrderableById(id);
  }
}
