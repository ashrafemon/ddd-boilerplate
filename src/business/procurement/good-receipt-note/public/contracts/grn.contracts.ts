export interface GrnReference {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
    total: number;
  }[];
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}