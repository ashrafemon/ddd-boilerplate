import { GrnQueryRecord } from '../types/grn.types';

export abstract class GrnQueryRepositoryPort {
  abstract findById(id: string): Promise<GrnQueryRecord | null>;
  abstract findByGrnNumber(grnNumber: string): Promise<GrnQueryRecord | null>;
  abstract findAll(query: { page: number; pageSize: number }): Promise<{ items: GrnQueryRecord[]; page: number; pageSize: number; total: number; totalPages: number }>;
}