import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { PostGrnUseCase } from './post-grn.usecase';

/**
 * Legacy `PATCH /grn/:id/complete` (and the batch `complete` operation).
 *
 * Delegates to `PostGrnUseCase` — the same single-record path a hand-posted
 * GRN takes. This keeps the status model honest: COMPLETED now always means
 * "posted", i.e. the PO receipt balance was registered atomically with the
 * transition. Before, `complete` could reach COMPLETED without registering
 * anything, which would have made a later reversal return quantities that
 * were never received (GRN-05 / PO-07).
 */
@Injectable()
export class CompleteGrnUseCase {
  constructor(private readonly postGrn: PostGrnUseCase) {}

  @Transactional()
  async execute(id: string, actorId?: string): Promise<GrnId> {
    return this.postGrn.execute({ id, actorId });
  }
}
