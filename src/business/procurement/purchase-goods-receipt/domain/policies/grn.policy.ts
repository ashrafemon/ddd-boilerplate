import { GrnStatus } from '../types/grn.enum';

export class GrnPolicy {
  static enforceGrnReceiveAllowed(status: GrnStatus, lineCount: number): void {
    if (lineCount < 1) {
      throw Object.assign(new Error('GRN must have at least one line to receive'), {
        statusCode: 422,
      });
    }
    if (status !== GrnStatus.DRAFT) {
      throw Object.assign(new Error(`Cannot receive GRN in status ${status}`), { statusCode: 422 });
    }
  }

  static enforceGrnCompleteAllowed(status: GrnStatus): void {
    if (status !== GrnStatus.RECEIVED) {
      throw Object.assign(new Error(`Cannot complete GRN in status ${status}`), {
        statusCode: 422,
      });
    }
  }

  static enforceGrnCancelAllowed(status: GrnStatus): void {
    if (status === GrnStatus.POSTED) {
      throw Object.assign(new Error('Cannot cancel a posted GRN'), {
        statusCode: 422,
      });
    }
    if (status === GrnStatus.CANCELLED) {
      throw Object.assign(new Error('GRN is already cancelled'), {
        statusCode: 422,
      });
    }
  }

  static enforceGrnInspectAllowed(status: GrnStatus): void {
    if (status !== GrnStatus.RECEIVED) {
      throw Object.assign(
        new Error(`Inspection can only be recorded on RECEIVED GRN, current: ${status}`),
        { statusCode: 422 },
      );
    }
  }
}
