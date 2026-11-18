import { PrismaClient } from '../src/generated/client';
import { DEFAULT_COMPANY_ID } from '@platform/platform-common/context/company';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { makeProducts } from '../src/specifications/support/factories/product.factory';
import { makeVendors } from '../src/specifications/support/factories/vendor.factory';
import { seedFaker } from '../src/specifications/support/factories/seed';
import { SAGA_DEFINITION_CATALOG } from '@platform/platform-common/saga/types/definitions/goods-receipt.definition';
import { parseSagaDefinition } from '@platform/platform-common/saga/types/saga-definition.parser';

/**
 * Development seed.
 *
 * Volumes and identities are fixed so re-running is idempotent (upserts on the
 * per-company natural keys); the descriptive values come from faker with a
 * fixed seed, so every run produces the same catalogue.
 */
const PRODUCT_COUNT = 12;
const VENDOR_COUNT = 4;

async function main() {
  seedFaker();

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding products...');
  for (const product of makeProducts(PRODUCT_COUNT)) {
    // The natural key is per COMPANY (the numbering/master data scope), so
    // the upsert keys on the compound unique, not on the sku alone.
    await prisma.product.upsert({
      where: { companyId_sku: { companyId: DEFAULT_COMPANY_ID, sku: product.sku } },
      create: { ...product, companyId: DEFAULT_COMPANY_ID },
      update: product,
    });
  }

  console.log('Seeding vendors...');
  for (const vendor of makeVendors(VENDOR_COUNT)) {
    await prisma.vendor.upsert({
      where: { companyId_code: { companyId: DEFAULT_COMPANY_ID, code: vendor.code } },
      create: { ...vendor, companyId: DEFAULT_COMPANY_ID },
      update: vendor,
    });
  }

  console.log('Seeding notification templates...');
  const notificationTemplates = [
    {
      notificationType: 'PurchaseOrderApproved',
      channel: 'EMAIL',
      locale: 'en-US',
      version: 1,
      subject: 'Purchase Order {{orderNumber}} Approved',
      body:
        'Hello {{vendorName}},\n\n' +
        'Purchase order {{orderNumber}} has been approved for {{currency}} {{total}}.\n\n' +
        'Thank you.',
      bodyFormat: 'text',
    },
  ];
  for (const template of notificationTemplates) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: {
        tenantId: null,
        notificationType: template.notificationType,
        channel: template.channel,
        locale: template.locale,
        version: template.version,
      },
    });
    if (!existing) {
      await prisma.notificationTemplate.create({
        data: { ...template, tenantId: null, isActive: true },
      });
    }
  }

  console.log('Seeding saga definitions...');
  for (const entry of SAGA_DEFINITION_CATALOG) {
    const definition = parseSagaDefinition(entry.document);
    const existing = await prisma.sagaDefinition.findUnique({
      where: { sagaKey_version: { sagaKey: definition.key, version: definition.version } },
    });
    if (!existing) {
      await prisma.sagaDefinition.create({
        data: {
          sagaKey: definition.key,
          ownerModule: entry.ownerModule,
          version: definition.version,
          eventName: definition.start.event.name,
          eventVersion: definition.start.event.version,
          status: 'ACTIVE',
          definition: definition as unknown as object,
          createdBy: 'seed',
        },
      });
    }
  }

  const count = {
    products: await prisma.product.count(),
    vendors: await prisma.vendor.count(),
    notificationTemplates: await prisma.notificationTemplate.count(),
    sagaDefinitions: await prisma.sagaDefinition.count(),
  };
  console.log('Seed complete:', count);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
