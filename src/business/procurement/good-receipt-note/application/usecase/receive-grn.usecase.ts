import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ReceiveGrnRequest } from '../../domain/types/grn.types';
import { GrnId } from '../../domain/value-objects';
import { GrnCommandRepositoryPort } from '../../domain/ports';
import { GrnIntegrationPort } from '../integrations';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class ReceiveGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepositoryPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: ReceiveGrnRequest): Promise<GrnId> {
    const company = await this.companyConfig.getCompanyConfig();

    const id = GrnId.fromString(input.id);
    const grn = await this.grnRepository.findById(id);
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