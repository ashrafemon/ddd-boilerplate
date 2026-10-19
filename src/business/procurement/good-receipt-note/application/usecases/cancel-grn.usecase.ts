import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';

@Injectable()
export class CancelGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly integrationEvent: GrnIntegrationPort,
  ) {}

  @Transactional()
  async execute(id: string): Promise<GrnId> {
    const grnId = GrnId.fromString(id);
    const grn = await this.grnRepository.findById(id);
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.cancel();

    await this.grnRepository.update(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id;
  }
}
