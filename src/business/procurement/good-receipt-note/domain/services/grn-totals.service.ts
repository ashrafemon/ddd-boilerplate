export class GrnTotalsService {
  static subtotal(lines: { total: number }[]): number {
    return lines.reduce((acc, line) => acc + line.total, 0);
  }
}
