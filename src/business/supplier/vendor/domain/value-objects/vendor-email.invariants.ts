import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ email: string }>('vendor-email.create', {
  name: 'vendor-email-format',
  check: ({ email }) => {
    if (!email) return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw Object.assign(new Error('Invalid vendor email'), { statusCode: 422 });
    }
  },
});
