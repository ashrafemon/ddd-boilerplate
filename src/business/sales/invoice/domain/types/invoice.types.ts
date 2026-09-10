import { InvoiceLine } from '../value-objects/invoice-line.vo';
import { InvoiceNumber } from '../value-objects/invoice-number.vo';
import { InvoiceStatus } from './invoice.enum';

export { InvoiceStatus } from './invoice.enum';

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceProps {
  invoiceNo: InvoiceNumber;
  customerId: string;
  status: InvoiceStatus;
  currency: string;
  lines: InvoiceLine[];
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvoiceInput {
  invoiceNo: string;
  customerId: string;
  currency: string;
  lines: InvoiceLineInput[];
}

export interface CreateInvoiceRequest {
  customerId: string;
  currency?: string;
  lines: InvoiceLineInput[];
}

export interface InvoiceState {
  status: InvoiceStatus;
}

export interface InvoiceLineRecord {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceQueryRecord {
  id: string;
  invoiceNo: string;
  customerId: string;
  status: string;
  currency: string;
  totalAmount: number;
  lines: InvoiceLineRecord[];
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
