import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ code: string }>('vendor-code.create', {
  name: 'vendor-code-format',
  check: ({ code }) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw Object.assign(new Error('Vendor code cannot be empty'), { statusCode: 422 });
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(normalized)) {
      throw Object.assign(
        new Error('Vendor code must be 2-32 chars of letters, digits or dashes'),
        { statusCode: 422 },
      );
    }
  },
});
