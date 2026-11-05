export interface NextNumberOptions {
  prefix?: string;
  padding?: number;
}

export abstract class NumberingPort {
  abstract nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string>;
}
