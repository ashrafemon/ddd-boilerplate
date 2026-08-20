import { Injectable } from '@nestjs/common';
import {
  VendorQueryRepositoryPort,
  VendorQueryRecord,
  VendorQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class GetVendorUseCase {
  constructor(private readonly vendorQueryRepo: VendorQueryRepositoryPort) {}

  async execute(id: string): Promise<VendorQueryRecord | null> {
    return this.vendorQueryRepo.findById(id);
  }
}
