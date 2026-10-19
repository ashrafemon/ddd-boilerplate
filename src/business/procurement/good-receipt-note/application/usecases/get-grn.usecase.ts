import { Injectable } from '@nestjs/common';
import { GrnQuery } from '../../application/queries/grn.query';
import { GrnQueryRecord } from '../../domain/types/grn.types';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

/**
 * Read a single goods receipt note.
 *
 * Cached under `grn:<id>`; the command use cases that mutate the GRN
 * invalidate that key after a successful write, so a cached entry can never
 * outlive the state it describes.
 */
@Injectable()
export class GetGrnUseCase {
  constructor(
    private readonly grnQueryRepo: GrnQuery,
    private readonly readCache: ReadCachePort,
  ) {}

  async execute(id: string): Promise<GrnQueryRecord | null> {
    return this.readCache.getOrLoad(`grn:${id}`, () => this.grnQueryRepo.findById(id));
  }
}
