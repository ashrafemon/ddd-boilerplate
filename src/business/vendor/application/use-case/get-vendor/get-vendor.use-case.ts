import { Injectable } from '@nestjs/common';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { VendorReadRepositoryPort, VendorReadModel } from '../../../domain/port/vendor-read-repository.port';
import { GetVendorInput, VendorOutput } from '../../type/vendor.output';
import { GetVendorPort } from '../../port/get-vendor.port';

/**
 * Query use case reading a vendor through the read repository.
 */
@Injectable()
export class GetVendorUseCase implements GetVendorPort {
  constructor(
    private readonly readRepository: VendorReadRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async execute(input: GetVendorInput): Promise<VendorOutput> {
    const readModel = await this.readRepository.findById(input.vendorId);

    if (!readModel) {
      throw new AggregateNotFoundException('Vendor', input.vendorId);
    }

    return toOutput(readModel);
  }
}

export function toOutput(readModel: VendorReadModel): VendorOutput {
  return {
    id: readModel.id,
    tenantId: readModel.tenantId,
    organizationId: readModel.organizationId,
    code: readModel.code,
    name: readModel.name,
    status: readModel.status,
    email: readModel.email,
    phone: readModel.phone,
    taxIdentifier: readModel.taxIdentifier,
    addresses: readModel.addresses.map((address) => ({
      id: address.id,
      type: address.type,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    })),
  };
}
