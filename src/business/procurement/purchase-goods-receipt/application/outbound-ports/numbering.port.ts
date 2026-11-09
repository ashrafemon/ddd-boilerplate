export interface NextNumberOptions {
  prefix?: string;
  padding?: number;
}

/** Module-local numbering port (platform NumberingPort is wrapped by an adapter). */
export abstract class NumberingPort {
  abstract nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string>;
}
