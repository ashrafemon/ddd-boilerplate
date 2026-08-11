import { PrismaClient } from '../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding products...');
  const products = [
    { sku: 'SKU-001', name: 'Wireless Mouse', description: '2.4GHz wireless mouse', unitPrice: '19.99', currency: 'USD' },
    { sku: 'SKU-002', name: 'Mechanical Keyboard', description: 'TKL mechanical keyboard', unitPrice: '89.50', currency: 'USD' },
    { sku: 'SKU-003', name: '27" 4K Monitor', description: 'UHD IPS monitor', unitPrice: '349.00', currency: 'USD' },
    { sku: 'SKU-004', name: 'USB-C Dock', description: '8-in-1 USB-C hub/dock', unitPrice: '59.99', currency: 'USD' },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: p,
      update: p,
    });
  }

  console.log('Seeding vendors...');
  const vendors = [
    { code: 'VEN-001', name: 'Acme Supplies', email: 'billing@acme.com' },
    { code: 'VEN-002', name: 'Globex Electronics', email: 'orders@globex.io' },
  ];
  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { code: v.code },
      create: v,
      update: v,
    });
  }

  const count = {
    products: await prisma.product.count(),
    vendors: await prisma.vendor.count(),
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
