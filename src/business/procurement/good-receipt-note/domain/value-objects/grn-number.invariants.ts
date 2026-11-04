import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ grnNumber: string }>('grn-number.create', {
  name: 'grn-number-required',
  check: ({ grnNumber }) => {
    if (!grnNumber.trim()) {
      throw Object.assign(new Error('GRN number cannot be empty'), { statusCode: 422 });
    }
  },
});
