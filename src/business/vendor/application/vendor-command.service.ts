import { Injectable } from '@nestjs/common';
import {
  CreateVendorInput,
  UpdateVendorInput,
  VendorCommandPort,
} from '../ports/inbound/vendor.command.port';
import { CreateVendorUseCase } from './use-cases/create-vendor.use-case';
import { UpdateVendorUseCase } from './use-cases/update-vendor.use-case';
import { VendorStatusUseCase } from './use-cases/vendor-status.use-case';
import { VendorId } from '../domain/value-objects/vendor-id.vo';

@Injectable()
export class VendorCommandService implements VendorCommandPort {
  constructor(
    private readonly createVendorUseCase: CreateVendorUseCase,
    private readonly updateVendorUseCase: UpdateVendorUseCase,
    private readonly vendorStatusUseCase: VendorStatusUseCase,
  ) {}

  createVendor(input: CreateVendorInput): Promise<VendorId> {
    return this.createVendorUseCase.execute(input);
  }

  updateVendor(input: UpdateVendorInput): Promise<VendorId> {
    return this.updateVendorUseCase.execute(input);
  }

  activateVendor(id: string): Promise<VendorId> {
    return this.vendorStatusUseCase.execute({ id, action: 'activate' });
  }

  deactivateVendor(id: string): Promise<VendorId> {
    return this.vendorStatusUseCase.execute({ id, action: 'deactivate' });
  }

  blockVendor(id: string): Promise<VendorId> {
    return this.vendorStatusUseCase.execute({ id, action: 'block' });
  }
}
