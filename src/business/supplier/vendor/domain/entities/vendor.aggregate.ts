import { AggregateRoot } from '@business/shared-business/domain/bases';
import { invariantRegistry } from '@business/shared-business/domain/invariants';
import { VendorId } from '../value-objects';
import { VendorCode, VendorEmail, VendorName } from '../value-objects';
import {
  VendorActivated,
  VendorBlocked,
  VendorDeactivated,
  VendorUpdated,
} from '../events';

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface VendorProps {
  code: VendorCode;
  name: VendorName;
  email: VendorEmail | null;
  phone: string | null;
  address: string | null;
  status: VendorStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVendorInput {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export class Vendor extends AggregateRoot<VendorId> {
  private props: VendorProps;

  private constructor(id: VendorId, props: VendorProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  /** Construction entry point reserved for the domain factory. */
  static instantiate(id: VendorId, props: VendorProps, version: number): Vendor {
    return new Vendor(id, props, version);
  }

  get code(): string {
    return this.props.code.value;
  }

  get name(): string {
    return this.props.name.value;
  }

  get email(): string | null {
    return this.props.email?.value ?? null;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get address(): string | null {
    return this.props.address;
  }

  get status(): VendorStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOrderable(): boolean {
    return this.props.status === VendorStatus.ACTIVE;
  }

  update(input: { name?: string; email?: string; phone?: string; address?: string }): void {
    if (input.name !== undefined) {
      this.props.name = VendorName.create(input.name);
    }
    if (input.email !== undefined) {
      this.props.email = input.email ? VendorEmail.create(input.email) : null;
    }
    if (input.phone !== undefined) {
      this.props.phone = input.phone.trim() || null;
    }
    if (input.address !== undefined) {
      this.props.address = input.address.trim() || null;
    }
    this.props.updatedAt = new Date();
    this.addEvent(new VendorUpdated(this.id));
  }

  activate(): void {
    invariantRegistry.enforce('vendor.status-transition', {
      status: this.props.status,
      to: VendorStatus.ACTIVE,
    });
    this.props.status = VendorStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new VendorActivated(this.id));
  }

  deactivate(): void {
    invariantRegistry.enforce('vendor.status-transition', {
      status: this.props.status,
      to: VendorStatus.INACTIVE,
    });
    this.props.status = VendorStatus.INACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new VendorDeactivated(this.id));
  }

  block(): void {
    invariantRegistry.enforce('vendor.status-transition', {
      status: this.props.status,
      to: VendorStatus.BLOCKED,
    });
    this.props.status = VendorStatus.BLOCKED;
    this.props.updatedAt = new Date();
    this.addEvent(new VendorBlocked(this.id));
  }
}
