import { NoopAbacAdapter } from './noop-abac.adapter';
import { ProductionAbacAdapter } from './production-abac.adapter';
import { AbacCheck } from '../ports/abac.port';

const check: AbacCheck = {
  context: {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    userId: 'user-1',
    roles: ['admin'],
  },
  resource: 'Vendor',
  action: 'create',
};

describe('ABAC adapter security', () => {
  it('noop adapter fails open for local/dev', async () => {
    await expect(new NoopAbacAdapter().evaluate(check)).resolves.toMatchObject({
      decision: 'ALLOW',
    });
  });

  it('production adapter fails closed', async () => {
    await expect(new ProductionAbacAdapter().evaluate(check)).resolves.toMatchObject({
      decision: 'DENY',
    });
  });
});
