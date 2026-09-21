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
  it('acquires with SET NX PX and returns true', async () => {
    const client = fakeClient();
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    const result = await adapter.acquire('job-1', 'owner-token', 5_000);

    const [setArgs] = client.set.mock.calls as [string, string, string, number, string][];
    expect(setArgs[0]).toBe('lock:job-1');
    expect(setArgs[1]).toBe('owner-token');
    expect(setArgs.slice(2)).toEqual(['PX', 5_000, 'NX']);
    expect(result).toBe(true);
  });

  it('returns false when the key is already held', async () => {
    const client = fakeClient();
    client.set.mockResolvedValue(null);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    await expect(adapter.acquire('job-1', 'owner-token', 5_000)).resolves.toBe(false);
  });

  it('fail-closes when Redis is missing', async () => {
    const adapter = new RedisDistributedLockAdapter(undefined);

    await expect(adapter.acquire('job-1', 'owner-token', 5_000)).resolves.toBe(false);
  });

  it('renews via Lua script when owner matches', async () => {
    const client = fakeClient();
    client.eval.mockResolvedValue(1);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    const result = await adapter.renew('job-1', 'owner-token', 5_000);

    expect(result).toBe(true);
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get'"),
      1,
      'lock:job-1',
      'owner-token',
      '5000',
    );
  });

  it('returns false on renew when owner does not match', async () => {
    const client = fakeClient();
    client.eval.mockResolvedValue(0);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    await expect(adapter.renew('job-1', 'wrong-owner', 5_000)).resolves.toBe(false);
  });

  it('releases via Lua script when owner matches', async () => {
    const client = fakeClient();
    client.eval.mockResolvedValue(1);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    const result = await adapter.release('job-1', 'owner-token');

    expect(result).toBe(true);
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('del'"),
      1,
      'lock:job-1',
      'owner-token',
    );
  });

  it('returns false on release when owner does not match', async () => {
    const client = fakeClient();
    client.eval.mockResolvedValue(0);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    await expect(adapter.release('job-1', 'wrong-owner')).resolves.toBe(false);
  });

  it('checks existence for isHeld', async () => {
    const client = fakeClient();
    client.exists.mockResolvedValue(1);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    expect(await adapter.isHeld('job-1')).toBe(true);
    expect(client.exists).toHaveBeenCalledWith('lock:job-1');
  });

  it('returns false for isHeld when key does not exist', async () => {
    const client = fakeClient();
    client.exists.mockResolvedValue(0);
    const adapter = new RedisDistributedLockAdapter(redisFor(client));

    expect(await adapter.isHeld('job-1')).toBe(false);
  });
});
