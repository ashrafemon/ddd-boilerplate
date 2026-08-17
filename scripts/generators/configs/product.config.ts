import type { ModuleConfig } from './module.generator';

export const config: ModuleConfig = {
  name: 'product',
  context: 'catalog',
  displayName: 'Product',
  entityName: 'Product',
  entityNamePlural: 'Products',
  properties: [
    { name: 'sku', type: 'string', required: true },
    { name: 'name', type: 'string', required: true, maxLength: 200 },
    { name: 'unitPrice', type: 'money', required: true },
    { name: 'description', type: 'text' },
  ],
  states: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'],
  events: [
    { name: 'Created', fields: ['sku', 'name', 'unitPrice', 'currency'] },
    { name: 'Updated', fields: [] },
    { name: 'Activated', fields: [] },
    { name: 'Deactivated', fields: [] },
    { name: 'Discontinued', fields: [] },
  ],
};

export default config;
