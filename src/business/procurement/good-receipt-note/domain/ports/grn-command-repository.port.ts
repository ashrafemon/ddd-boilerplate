import { Grn } from '../entities/grn.aggregate';

export abstract class GrnCommandRepositoryPort {
  abstract save(grn: Grn): Promise<Grn>;
  abstract update(grn: Grn): Promise<Grn>;
  abstract findById(id: string): Promise<Grn | null>;
  abstract findByGrnNumber(grnNumber: string): Promise<Grn | null>;
  abstract nextGrnSequence(): Promise<number>;
}