import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: { code: 'DEMO', name: 'Demo Tenant' },
  });

  const organization = await prisma.organization.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'DEMO-ORG' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'DEMO-ORG',
      name: 'Demo Organization',
      config: {
        purchase: {
          approvalLimitCents: 1000000,
          requireApprovalAboveCents: 50000,
        },
        numbering: { prefix: 'PO', nextSequence: 1 },
      },
    },
  });

  await prisma.vendor.upsert({
    where: {
      tenantId_organizationId_code: { tenantId: tenant.id, organizationId: organization.id, code: 'V-0001' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      organizationId: organization.id,
      code: 'V-0001',
      name: 'Acme Supplies Ltd',
      email: 'sales@acme.example',
      phone: '+1-555-0100',
      taxIdentifier: 'US-123456789',
      status: 'ACTIVE',
    },
  });

  const category = await prisma.productCategory.upsert({
    where: {
      tenantId_organizationId_code: { tenantId: tenant.id, organizationId: organization.id, code: 'RAW' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      organizationId: organization.id,
      code: 'RAW',
      name: 'Raw Materials',
    },
  });

  await prisma.product.upsert({
    where: {
      tenantId_organizationId_code: { tenantId: tenant.id, organizationId: organization.id, code: 'P-0001' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      organizationId: organization.id,
      code: 'P-0001',
      name: 'Steel Sheet',
      sku: 'STL-SHT-001',
      unit: 'KG',
      status: 'ACTIVE',
      isPurchasable: true,
      isSellable: true,
      priceCents: 450,
      currency: 'USD',
      categoryId: category.id,
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
