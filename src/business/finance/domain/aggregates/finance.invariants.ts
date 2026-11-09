import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ debit: number; credit: number }>('journal-entry.entry', {
  name: 'journal-entry-debit-credit',
  check: ({ debit, credit }) => {
    if (!Number.isFinite(debit) || debit < 0) {
      throw Object.assign(new Error('Debit cannot be negative'), { statusCode: 422 });
    }
    if (!Number.isFinite(credit) || credit < 0) {
      throw Object.assign(new Error('Credit cannot be negative'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ amount: number }>('vendor-bill.amount', {
  name: 'vendor-bill-amount-positive',
  check: ({ amount }) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Vendor bill amount must be positive'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ outstanding: number; amount: number }>(
  'payable-open-item.outstanding',
  {
    name: 'payable-outstanding-valid',
    check: ({ outstanding, amount }) => {
      if (!Number.isFinite(outstanding) || outstanding < 0) {
        throw Object.assign(new Error('Outstanding cannot be negative'), { statusCode: 422 });
      }
      if (outstanding > amount) {
        throw Object.assign(new Error('Outstanding cannot exceed total amount'), {
          statusCode: 422,
        });
      }
    },
  },
);
