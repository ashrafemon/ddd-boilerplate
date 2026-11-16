import { ReadCacheAdapter } from './read-cache.adapter';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

function makeAdapter() {
  const cache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    buildKey: jest.fn().mockReturnValue('cache-key'),
  };
  const context = {
    getTenantId: jest.fn().mockReturnValue('tenant-1'),
    getCompanyId: jest.fn().mockReturnValue('company-1'),
  };
  const adapter = new ReadCacheAdapter(cache, context as unknown as RequestContextPort);
  return { adapter, cache, context };
}

describe('Grn ReadCacheAdapter', () => {
  it('returns a cache hit without loading', async () => {
    const { adapter, cache } = makeAdapter();
    cache.get.mockResolvedValue({ status: 'HIT', value: 'cached' });
    const load = jest.fn();
    await expect(adapter.getOrLoad('key', load)).resolves.toBe('cached');
    expect(load).not.toHaveBeenCalled();
  });

  it('loads and stores on a cache miss', async () => {
    const { adapter, cache } = makeAdapter();
    cache.get.mockResolvedValue({ status: 'MISS' });
    await expect(adapter.getOrLoad('key', async () => 'fresh')).resolves.toBe('fresh');
    expect(cache.set).toHaveBeenCalledWith('cache-key', 'fresh');
  });

  it('scopes keys to the tenant and company', async () => {
    const { adapter, cache } = makeAdapter();
    cache.get.mockResolvedValue({ status: 'MISS' });
    await adapter.getOrLoad('key', async () => 'value');
    expect(cache.buildKey).toHaveBeenCalledWith({
      namespace: 'read',
      resource: 'key',
      tenantId: 'tenant-1',
      companyId: 'company-1',
    });
  });

  it('invalidates the scoped key', async () => {
    const { adapter, cache } = makeAdapter();
    await adapter.invalidate('key');
    expect(cache.delete).toHaveBeenCalledWith('cache-key');
  });

  it('swallows cache write failures', async () => {
    const { adapter, cache } = makeAdapter();
    cache.get.mockResolvedValue({ status: 'MISS' });
    cache.set.mockRejectedValue(new Error('down'));
    await expect(adapter.getOrLoad('key', async () => 'value')).resolves.toBe('value');
  });
});
