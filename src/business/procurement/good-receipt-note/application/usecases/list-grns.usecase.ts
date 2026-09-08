import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { GrnQueryRepositoryPort } from '../../domain/domain-ports/grn-query-repository.port';
import { GrnQueryRecord } from '../../domain/types/grn.types';

@Injectable()
export class ListGrnsUseCase {
  constructor(private readonly grnQueryRepo: GrnQueryRepositoryPort) {}

  async execute(query: PageQuery): Promise<PageResult<GrnQueryRecord>> {
    return this.grnQueryRepo.findAll(query);
  }
}
