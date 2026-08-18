import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ name: string }>('vendor-name.create', {
  name: 'vendor-name-length',
  check: ({ name }) => {
    const normalized = name.trim();
    if (!normalized) {
      throw Object.assign(new Error('Vendor name cannot be empty'), { statusCode: 422 });
    }
    if (normalized.length > 200) {
      throw Object.assign(new Error('Vendor name cannot exceed 200 characters'), {
        statusCode: 422,
      });
    }
  },
});
