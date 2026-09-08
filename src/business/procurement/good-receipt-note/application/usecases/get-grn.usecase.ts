import { Injectable } from '@nestjs/common';
import { GrnQuery } from '../../application/queries/grn.query';
import { GrnQueryRecord } from '../../domain/types/grn.types';

@Injectable()
export class GetGrnUseCase {
  constructor(private readonly grnQueryRepo: GrnQuery) {}

  async execute(id: string): Promise<GrnQueryRecord | null> {
    return this.grnQueryRepo.findById(id);
  }
}
