export class GrnNumberInvariants {
  static enforceGrnNumberFormat(grnNumber: string): void {
    if (!grnNumber?.trim()) {
      throw Object.assign(new Error('GRN number is required'), { statusCode: 422 });
    }
    if (!/^GRN-[A-Z0-9-]{1,32}$/.test(grnNumber.trim())) {
      throw Object.assign(new Error('GRN number must match GRN-<identifier>'), { statusCode: 422 });
    }
  }
}
