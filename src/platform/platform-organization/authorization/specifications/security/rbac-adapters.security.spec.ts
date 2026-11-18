import { NoopRbacAdapter } from '../../adapters/noop-rbac.adapter';
import { ProductionRbacAdapter } from '../../adapters/production-rbac.adapter';

const check = { userId: 'user-1', resource: 'Vendor', action: 'create' };

describe('RBAC adapter security', () => {
  it('noop adapter fails open for local/dev', async () => {
    await expect(new NoopRbacAdapter().can(check)).resolves.toBe(true);
  });

  it('production adapter fails closed', async () => {
    await expect(new ProductionRbacAdapter().can(check)).resolves.toBe(false);
  });
});
