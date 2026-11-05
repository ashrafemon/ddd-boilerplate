import { Injectable, NotFoundException } from '@nestjs/common';
import { GrnQuery } from '../../application/queries/grn.query';
import { GrnQueryRecord } from '../../domain/types/grn.types';

/**
 * Read a single goods receipt note.
 *
 * Read-side caching is owned by the `@Cacheable()` controller decorator
 * (tenant-scoped, fail-open); this use case only reads the authoritative
 * repository inside the request's CLS transaction.
 */
@Injectable()
export class GetGrnUseCase {
  constructor(private readonly grnQueryRepo: GrnQuery) {}

  async execute(id: string): Promise<GrnQueryRecord> {
    const record = await this.grnQueryRepo.findById(id);
    if (!record) {
      throw new NotFoundException('GRN not found');
    }
    return record;
  }
}
