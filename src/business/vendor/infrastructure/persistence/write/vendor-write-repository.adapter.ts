import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { Vendor } from '../../../domain/aggregate/vendor/vendor.entity';
import { VendorId } from '../../../domain/aggregate/vendor/vendor-id.vo';
import {
  VendorAddressPersistenceData,
  VendorBankAccountPersistenceData,
  VendorContactPersistenceData,
  VendorCreatePersistenceData,
  VendorPersistenceData,
  VendorWriteRepositoryPort,
} from '../../../domain/port/vendor-write-repository.port';
import { VendorBuilder } from '../../../domain/service/vendor-builder.service';
import { VendorMapper } from '../vendor.mapper';

type TxClient = Prisma.TransactionClient;

/**
 * Write-side persistence for the Vendor aggregate. Joins the CLS-managed
 * transaction transparently.
 *
 * The repository persists plain data (`VendorPersistenceData`) — it never
 * receives the aggregate. The domain is only used to enforce invariants and
 * record domain events.
 */
@Injectable()
export class PrismaVendorWriteRepositoryAdapter implements VendorWriteRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly builder: VendorBuilder,
  ) {}

  public async save(data: VendorPersistenceData): Promise<void> {
    const client = this.getClient();

    if (data.operation === 'create') {
      await client.vendor.create({
        data: {
          id: data.id,
          tenantId: data.tenantId,
          organizationId: data.organizationId,
          code: data.code,
          name: data.name,
          status: data.status,
          email: data.email ?? null,
          phone: data.phone ?? null,
          taxIdentifier: data.taxIdentifier ?? null,
          addresses: data.addresses?.length
            ? { create: data.addresses.map((item) => this.toAddressCreate(data, item)) }
            : undefined,
          contacts: data.contacts?.length
            ? { create: data.contacts.map((item) => this.toContactCreate(data, item)) }
            : undefined,
          bankAccounts: data.bankAccounts?.length
            ? { create: data.bankAccounts.map((item) => this.toBankAccountCreate(data, item)) }
            : undefined,
        },
      });
      return;
    }

    const existing = await client.vendor.findUnique({ where: { id: data.id } });
    if (!existing) {
      throw new AggregateNotFoundException('Vendor', data.id);
    }

    await client.vendor.update({
      where: { id: data.id },
      data: {
        code: data.code,
        name: data.name,
        status: data.status,
        email: data.email,
        phone: data.phone,
        taxIdentifier: data.taxIdentifier,
      },
    });

    if (data.addresses !== undefined) {
      await client.vendorAddress.deleteMany({ where: { vendorId: data.id } });
      if (data.addresses.length > 0) {
        await client.vendorAddress.createMany({
          data: data.addresses.map((item) => ({
            id: item.id,
            vendorId: data.id,
            tenantId: existing.tenantId,
            organizationId: existing.organizationId,
            type: item.type,
            line1: item.line1,
            line2: item.line2 ?? null,
            city: item.city,
            state: item.state ?? null,
            postalCode: item.postalCode ?? null,
            country: item.country,
          })),
        });
      }
    }

    if (data.contacts !== undefined) {
      await client.vendorContact.deleteMany({ where: { vendorId: data.id } });
      if (data.contacts.length > 0) {
        await client.vendorContact.createMany({
          data: data.contacts.map((item) => ({
            id: item.id,
            vendorId: data.id,
            tenantId: existing.tenantId,
            organizationId: existing.organizationId,
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            phone: item.phone ?? null,
            role: item.role ?? null,
            isPrimary: item.isPrimary,
          })),
        });
      }
    }

    if (data.bankAccounts !== undefined) {
      await client.vendorBankAccount.deleteMany({ where: { vendorId: data.id } });
      if (data.bankAccounts.length > 0) {
        await client.vendorBankAccount.createMany({
          data: data.bankAccounts.map((item) => ({
            id: item.id,
            vendorId: data.id,
            tenantId: existing.tenantId,
            organizationId: existing.organizationId,
            accountName: item.accountName,
            iban: item.iban,
            bankName: item.bankName ?? null,
            currency: item.currency,
            isDefault: item.isDefault,
          })),
        });
      }
    }
  }

  public async findById(id: VendorId): Promise<Vendor | null> {
    const row = await this.getClient().vendor.findUnique({
      where: { id: id.getValue() },
      include: { addresses: true, contacts: true, bankAccounts: true },
    });
    if (!row) return null;
    return this.builder.reconstitute(VendorMapper.toSnapshot(row));
  }

  public async findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<Vendor | null> {
    const row = await this.getClient().vendor.findFirst({
      where: { tenantId, organizationId, code: code.trim().toUpperCase() },
      include: { addresses: true, contacts: true, bankAccounts: true },
    });
    if (!row) return null;
    return this.builder.reconstitute(VendorMapper.toSnapshot(row));
  }

  private toAddressCreate(
    data: VendorCreatePersistenceData,
    item: VendorAddressPersistenceData,
  ): Prisma.VendorAddressUncheckedCreateWithoutVendorInput {
    return {
      id: item.id,
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      type: item.type,
      line1: item.line1,
      line2: item.line2 ?? null,
      city: item.city,
      state: item.state ?? null,
      postalCode: item.postalCode ?? null,
      country: item.country,
    };
  }

  private toContactCreate(
    data: VendorCreatePersistenceData,
    item: VendorContactPersistenceData,
  ): Prisma.VendorContactUncheckedCreateWithoutVendorInput {
    return {
      id: item.id,
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone ?? null,
      role: item.role ?? null,
      isPrimary: item.isPrimary,
    };
  }

  private toBankAccountCreate(
    data: VendorCreatePersistenceData,
    item: VendorBankAccountPersistenceData,
  ): Prisma.VendorBankAccountUncheckedCreateWithoutVendorInput {
    return {
      id: item.id,
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      accountName: item.accountName,
      iban: item.iban,
      bankName: item.bankName ?? null,
      currency: item.currency,
      isDefault: item.isDefault,
    };
  }

  private getClient(): TxClient {
    return this.txHost.tx;
  }
}
