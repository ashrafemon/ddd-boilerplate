import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ReceiveGrnRequest } from '../../domain/types/grn.types';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepositoryPort } from '../../domain/domain-ports/grn-command-repository.port';
import { GrnIntegrationPort } from '../integrations/publishers/grn.integration-port';

@Injectable()
export class ReceiveGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepositoryPort,
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
