export interface NextNumberOptions {
  prefix?: string;
  padding?: number;
}

/**
 * Document numbering port. Business modules ask the platform for the next
 * number of a document sequence (purchase order, invoice, journal, ...) so
 * numbering stays consistent and gap-free across the whole ERP.
 */
export abstract class NumberingPort {
  abstract nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string>;
}
