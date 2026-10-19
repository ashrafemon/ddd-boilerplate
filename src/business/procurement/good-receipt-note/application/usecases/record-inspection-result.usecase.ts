import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RecordInspectionResultRequest } from '../../domain/types/grn.types';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';

/**
 * Record the accepted/rejected split per line (plan Phase 3.2 / GRN-01):
 *
 * Runs on a RECEIVED GRN, before posting. The aggregate enforces
 * `received = accepted + rejected` per line, so nothing is double-dispositioned;
 * only the accepted quantity later enters stock and the PO balance (GRN-03,
 * Phase 3.3). Re-running with the same values is naturally idempotent — the
 * line state converges, no event, no double count.
 */
@Injectable()
export class RecordInspectionResultUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly integrationEvent: GrnIntegrationPort,
  ) {}

  @Transactional()
  async execute(input: RecordInspectionResultRequest): Promise<GrnId> {
    const grn = await this.grnRepository.findById(input.id);
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.recordInspectionResult({ lines: input.lines });
    await this.grnRepository.update(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id;
  }
}
