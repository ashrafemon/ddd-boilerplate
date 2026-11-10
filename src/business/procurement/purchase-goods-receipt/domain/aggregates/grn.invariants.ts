export class GrnInvariants {
  static enforceGrnCreate(purchaseOrderId: string): void {
    if (!purchaseOrderId?.trim()) {
      throw Object.assign(new Error('Purchase order ID is required'), { statusCode: 422 });
    }
  }

  static enforceGrnHasLines(lineCount: number): void {
    if (lineCount < 1) {
      throw Object.assign(new Error('GRN must have at least one line'), { statusCode: 422 });
    }
  }

  static enforceGrnReversal(reversalOfId: string): void {
    if (!reversalOfId) {
      throw Object.assign(new Error('Reversal requires reversalOfId'), { statusCode: 422 });
    }
  }

  static enforceGrnEditable(status: string): void {
    if (status !== 'DRAFT') {
      throw Object.assign(new Error('Only draft GRNs can be edited'), { statusCode: 422 });
    }
  }

  static enforceGrnStatusTransition(status: string, to: string): void {
    if (status === to) return;
    const allowed: Record<string, string[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['APPROVED'],
      APPROVED: ['ISSUED', 'CANCELLED'],
      ISSUED: ['CANCELLED'],
      CANCELLED: [],
    };
    if (!allowed[status].includes(to)) {
      throw Object.assign(new Error(`Invalid GRN status transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  }

  static enforceGrnReversible(status: string): void {
    if (status !== 'APPROVED') {
      throw Object.assign(new Error('Only approved GRNs can be reversed'), { statusCode: 422 });
    }
  }

  static enforceGrnInspectionBalance(expectedQuantity: number, receivedQuantity: number): void {
    if (receivedQuantity > expectedQuantity) {
      throw Object.assign(new Error(`Received quantity exceeds expected quantity`), {
        statusCode: 422,
      });
    }
  }
}
