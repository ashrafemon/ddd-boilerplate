import { Injectable } from '@nestjs/common';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { VendorReadRepositoryPort } from '../../../domain/port/vendor-read-repository.port';
import { ValidateVendorInput, ValidateVendorOutput } from '../../type/validate-vendor.output';
import { ValidateVendorPort } from '../../port/validate-vendor.port';

/**
 * Validates a vendor for consumption by other bounded contexts.
 */
@Injectable()
export class ValidateVendorUseCase implements ValidateVendorPort {
  constructor(private readonly readRepository: VendorReadRepositoryPort) {}

  public async execute(input: ValidateVendorInput): Promise<ValidateVendorOutput> {
    const readModel = await this.readRepository.findById(input.vendorId);

    if (!readModel) {
      throw new AggregateNotFoundException('Vendor', input.vendorId);
    }

    return {
      vendorId: readModel.id,
      code: readModel.code,
      name: readModel.name,
      status: readModel.status,
      isActive: readModel.status === 'ACTIVE',
    };
  }
}
