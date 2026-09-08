import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ReceiveGrnRequest } from '../../domain/types/grn.types';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';

@Injectable()
export class ReceiveGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly integrationEvent: GrnIntegrationPort,
  ) {}

  @Transactional()
  async execute(input: ReceiveGrnRequest): Promise<GrnId> {
    const id = GrnId.fromString(input.id);
    const grn = await this.grnRepository.findById(id.toString());
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.receive();
    await this.grnRepository.update(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id;
  }
}
