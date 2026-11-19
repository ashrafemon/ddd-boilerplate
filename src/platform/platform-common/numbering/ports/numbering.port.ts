/** Formatting options for one numbered document. */
export interface NextNumberOptions {
  prefix?: string;
  padding?: number;
}

/**
 * Inbound port: the numbering capability as business modules see it.
 *
 * A caller asks for "the next number of this series" and gets a formatted
 * string. Series are scoped per company by the use case, never by the caller,
 * so two companies can both hold `PO-00000001` without collision.
 */
export abstract class NumberingPort {
  abstract nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string>;
}
