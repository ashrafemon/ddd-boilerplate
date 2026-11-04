import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AddGrnLineRequest } from '../../domain/types/grn.types';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnPublisherPort } from '../integrations/publishes/grn.publisher-port';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

@Injectable()
export class AddGrnLineUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly integrationEvent: GrnPublisherPort,
    private readonly readCache: ReadCachePort,
  ) {}

  @Transactional()
  async execute(input: AddGrnLineRequest): Promise<string> {
    const id = input.id;
    const grn = await this.grnRepository.findById(id.toString());
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.addLine(input.productId, input.orderedQuantity, input.receivedQuantity, input.unitPrice);
    await this.grnRepository.update(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    await this.readCache.invalidate(`grn:${grn.id.toString()}`);

    return grn.id.toString();
  }
}
