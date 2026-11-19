import { NumberingPort } from '@platform/platform-common/numbering/ports/numbering.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NumberingAdapter implements NumberingPort {
  nextNumber(key: string, opts?: { prefix?: string; length?: number }): Promise<string> {
    const prefix = opts?.prefix ?? '';
    const length = opts?.length ?? 8;
    const num = Math.floor(Math.random() * 10 ** length)
      .toString()
      .padStart(length, '0');
    return Promise.resolve(`${prefix}${num}`);
  }
}
