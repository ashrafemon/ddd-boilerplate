/** Splits a list into fixed-size disjoint chunks (queue fan-out helpers). */
export class Chunker {
  static split<T>(items: readonly T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }
}
