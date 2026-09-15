import { RedisDistributedLockAdapter } from './redis-distributed-lock.adapter';
import { RedisService } from '@infrastructure/cache/redis/redis.service';

type FakeClient = {
  set: jest.Mock;
  eval: jest.Mock;
  exists: jest.Mock;
  del: jest.Mock;
};

const redisFor = (client: FakeClient | null) => ({ client }) as unknown as RedisService;

const fakeClient = (): FakeClient => ({
  set: jest.fn().mockResolvedValue('OK'),
  eval: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
});

describe('RedisDistributedLockAdapter', () => {
  it('acquires with an owner token and returns a ticket', async () => {
    const client = fakeClient();
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    const ticket = await adapter.acquire('job-1', 1_000);

    const [setArgs] = client.set.mock.calls as [string, string, string, number, string][];
    expect(setArgs[0]).toBe('platform:lock:job-1');
    expect(setArgs[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(setArgs.slice(2)).toEqual(['PX', 1_000, 'NX']);
    expect(ticket).not.toBeNull();
    expect(ticket?.key).toBe('job-1');
    expect(typeof ticket?.owner).toBe('string');
  });

  it('returns null when the key is already held', async () => {
    const client = fakeClient();
    client.set.mockResolvedValue(null);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    await expect(adapter.acquire('job-1', 1_000)).resolves.toBeNull();
  });

  it('fail-closes when Redis is missing', async () => {
    const adapter = new RedisDistributedLockAdapter(undefined);

    await expect(adapter.acquire('job-1', 1_000)).resolves.toBeNull();
    await expect(adapter.renew({ key: 'job-1', owner: 'o' }, 1_000)).resolves.toBe(false);
  });

  it('releases only for the matching owner (Lua compare-and-delete)', async () => {
    const client = fakeClient();
    const adapter = new RedisDistributedLockAdapter(redisFor(client));
    const ticket = { key: 'job-1', owner: 'owner-abc' };

    await adapter.release(ticket);

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"),
      1,
      'platform:lock:job-1',
      'owner-abc',
    );
  });

  it('renew reports lost ownership when the script returns 0', async () => {
    const client = fakeClient();
    client.eval.mockResolvedValue(0);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    await expect(adapter.renew({ key: 'job-1', owner: 'stale' }, 1_000)).resolves.toBe(false);
  });
});
