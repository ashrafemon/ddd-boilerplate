import { Injectable } from '@nestjs/common';
import { GrnQueryRepositoryPort } from '../../domain/ports';
import { GrnQueryRecord } from '../../domain/types/grn.types';

@Injectable()
export class GetGrnUseCase {
  constructor(private readonly grnQueryRepo: GrnQueryRepositoryPort) {}

  async execute(id: string): Promise<GrnQueryRecord | null> {
    return this.grnQueryRepo.findById(id);
  }
}