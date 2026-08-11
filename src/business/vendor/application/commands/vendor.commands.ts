import { CreateVendorInput } from '../../ports/inbound/vendor.command.port';

export class CreateVendorCommand implements CreateVendorInput {
  constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly email: string | undefined,
    public readonly phone: string | undefined,
    public readonly address: string | undefined,
  ) {}
}

export class UpdateVendorCommand {
  constructor(
    public readonly id: string,
    public readonly name: string | undefined,
    public readonly email: string | undefined,
    public readonly phone: string | undefined,
    public readonly address: string | undefined,
  ) {}
}

export class VendorStatusCommand {
  constructor(
    public readonly id: string,
    public readonly action: 'activate' | 'deactivate' | 'block',
  ) {}
}
