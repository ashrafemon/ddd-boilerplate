import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SetGrnLineTrackingRequest } from '../../domain/types/grn.types';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

@Injectable()
export class SetGrnLineTrackingUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly readCache: ReadCachePort,
  ) {}

  @Transactional()
  async execute(input: SetGrnLineTrackingRequest): Promise<string> {
    const id = input.id;
    const grn = await this.grnRepository.findById(id.toString());
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.setLineTracking(input.productId, input.entries);
    await this.grnRepository.update(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    await this.readCache.invalidate(`grn:${grn.id.toString()}`);

    return grn.id.toString();
  }
}
