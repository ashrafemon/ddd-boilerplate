import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { GrnQuery } from '../../application/queries/grn.query';
import { GrnQueryRecord } from '../../domain/types/grn.types';

@Injectable()
export class ListGrnsUseCase {
  constructor(private readonly grnQueryRepo: GrnQuery) {}

  async execute(query: PageQuery): Promise<PageResult<GrnQueryRecord>> {
    return this.grnQueryRepo.findAll(query);
  }
}
