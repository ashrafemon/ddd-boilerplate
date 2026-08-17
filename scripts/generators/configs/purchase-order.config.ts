import type { ModuleConfig } from '../module.generator';

export const config: ModuleConfig = {
  name: 'purchase-order',
  context: 'procurement',
  displayName: 'PurchaseOrder',
  entityName: 'PurchaseOrder',
  entityNamePlural: 'PurchaseOrders',
  properties: [
    { name: 'orderNumber', type: 'string', required: true },
    { name: 'vendorId', type: 'string', required: true },
    { name: 'currency', type: 'string', required: false },
  ],
  states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'],
  events: [
    { name: 'Created', fields: ['orderNumber', 'vendorId'] },
    { name: 'LineAdded', fields: ['productId'] },
    { name: 'LineRemoved', fields: ['productId'] },
    { name: 'Submitted', fields: ['orderNumber', 'vendorId'] },
    { name: 'Approved', fields: [] },
    { name: 'Rejected', fields: ['reason'] },
    { name: 'Cancelled', fields: [] },
    { name: 'Completed', fields: [] },
  ],
  outboundPorts: [
    { name: 'Vendor', portName: 'PURCHASE_ORDER_VENDOR_PORT', method: 'getOrderableVendor', returnType: 'Promise<Vendor | null>' },
    { name: 'Product', portName: 'PURCHASE_ORDER_PRODUCT_PORT', method: 'getPurchasableProduct', returnType: 'Promise<Product | null>' },
  ],
};

export default config;
