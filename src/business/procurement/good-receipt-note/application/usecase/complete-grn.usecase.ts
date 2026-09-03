import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnId } from '../../domain/value-objects';
import { GrnCommandRepositoryPort } from '../../domain/ports';
import { GrnIntegrationPort } from '../integrations';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CompleteGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepositoryPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(id: string): Promise<GrnId> {
    await this.companyConfig.getCompanyConfig();

    const grnId = GrnId.fromString(id);
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.complete();
    await this.grnRepository.update(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id;
  }
}