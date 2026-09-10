import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ invoiceNo: string }>('invoice-number.create', {
  name: 'invoice-number-format',
  check: ({ invoiceNo }) => {
    if (!/^INV-[A-Z0-9-]{1,32}$/.test(invoiceNo)) {
      throw Object.assign(new Error('Invoice number must match INV-<identifier>'), {
        statusCode: 422,
      });
    }
  },
});
