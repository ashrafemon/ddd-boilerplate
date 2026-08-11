import { Invariant } from '../../../../shared-business/invariant/invariant';

export interface VendorBankAccountsContext {
  ibans: string[];
}

/**
 * A vendor bank account must always carry a valid IBAN (already guaranteed by
 * the value object) — this invariant additionally prevents empty collections
 * from being silently accepted where at least one account is expected.
 */
export class VendorBankAccountIbanInvariant extends Invariant {
  public readonly name = 'vendor-bank-account-iban-must-be-present';

  public check(context: VendorBankAccountsContext): { isValid: boolean; messages: string[] } {
    for (const iban of context.ibans) {
      if (!iban) {
        return { isValid: false, messages: ['Vendor bank account requires an IBAN'] };
      }
    }
    return { isValid: true, messages: [] };
  }
}
