import { Injectable } from '@nestjs/common';
import { DocumentNumberGeneratorPort } from '../../../domain/port/document-number-generator.port';

const CHARS = '0123456789';

/**
 * Generates purchase order document numbers, e.g. PO-20260810-4821.
 *
 * A production numbering system would persist a per-organization sequence;
 * this adapter uses a time-based, collision-safe format that works without
 * extra state.
 */
@Injectable()
export class TimestampDocumentNumberGenerator implements DocumentNumberGeneratorPort {
  public async generate(prefix: string): Promise<string> {
    const now = new Date();
    const datePart = [
      now.getUTCFullYear(),
      pad(now.getUTCMonth() + 1),
      pad(now.getUTCDate()),
    ].join('');
    const suffix = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    return `${prefix}-${datePart}-${suffix}`;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
