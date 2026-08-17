import type { ModuleConfig } from '../module.generator';

export const config: ModuleConfig = {
  name: 'vendor',
  context: 'party',
  displayName: 'Vendor',
  entityName: 'Vendor',
  entityNamePlural: 'Vendors',
  properties: [
    { name: 'code', type: 'string', required: true, maxLength: 32 },
    { name: 'name', type: 'string', required: true, maxLength: 200 },
    { name: 'email', type: 'string', required: false },
    { name: 'phone', type: 'string', required: false },
    { name: 'address', type: 'text', required: false },
  ],
  states: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
  events: [
    { name: 'Created', fields: ['code', 'name'] },
    { name: 'Updated', fields: [] },
    { name: 'Activated', fields: [] },
    { name: 'Deactivated', fields: [] },
    { name: 'Blocked', fields: [] },
  ],
};

export default config;
