import { Injectable } from '@nestjs/common';
import { NextDocumentNumberUseCase } from '../../use-cases/next-document-number.usecase';
import { NextNumberOptions, NumberingPort } from '../ports/numbering.port';

/**
 * Inbound adapter implementing `NumberingPort`.
 *
 * Business modules inject the port; the scoping and formatting rules live in
 * `NextDocumentNumberUseCase`, never here.
 */
@Injectable()
export class NumberingAdapter implements NumberingPort {
  constructor(private readonly nextDocumentNumber: NextDocumentNumberUseCase) {}

  nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string> {
    return this.nextDocumentNumber.execute(sequenceKey, options);
  }
}
