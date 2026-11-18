import { HealthAdapter } from './health.adapter';
import { HealthReport } from '../../types/health.types';

/**
 * The adapter is a pure aggregator: every probe is wrapped so a thrown error
 * becomes `down` and the endpoint always answers. These cases pin that contract
 * without booting the infrastructure clients.
 */
describe('HealthAdapter', () => {
  function makeSut(overrides: Partial<Record<string, unknown>> = {}) {
    const deps = {
      prismaWrite: { $queryRaw: jest.fn(async () => []) },
      prismaRead: { $queryRaw: jest.fn(async () => []) },
      redis: { isEnabled: true, client: { ping: jest.fn(async () => 'PONG') } },
      rabbit: { connected: true },
      kafka: { isEnabled: false },
      s3: {
        bucketName: 'bucket',
        client: { send: jest.fn(async () => ({ $metadata: {} })) },
      },
      secretsManager: { isEnabled: false },
      puppeteer: { isEnabled: false },
      ses: { isEnabled: false },
      sns: { isEnabled: false },
      httpCache: { isEnabled: false },
      ...overrides,
    };
    const adapter = new HealthAdapter(
      deps.prismaWrite as never,
      deps.prismaRead as never,
      deps.redis as never,
      deps.rabbit as never,
      deps.kafka as never,
      deps.s3 as never,
      deps.secretsManager as never,
      deps.puppeteer as never,
      deps.ses as never,
      deps.sns as never,
      deps.httpCache as never,
    );
    return { adapter, deps };
  }

  it('reports ok when every enabled component answers', async () => {
    const { adapter } = makeSut();

    const report: HealthReport = await adapter.check();

    expect(report.status).toBe('ok');
    expect(report.components['database-write']).toBe('up');
    expect(report.components.kafka).toBe('disabled');
  });

  it('reports degraded and down when a probe throws', async () => {
    const { adapter } = makeSut({
      prismaWrite: {
        $queryRaw: jest.fn(async () => {
          throw new Error('connection refused');
        }),
      },
    });

    const report = await adapter.check();

    expect(report.status).toBe('degraded');
    expect(report.components['database-write']).toBe('down');
  });

  it('treats a non-PONG redis reply as down', async () => {
    const { adapter } = makeSut({
      redis: { isEnabled: true, client: { ping: jest.fn(async () => 'LOADING') } },
    });

    await expect(adapter.check()).resolves.toMatchObject({
      status: 'degraded',
      components: { redis: 'down' },
    });
  });

  it('never throws, even when several probes fail', async () => {
    const boom = jest.fn(async () => {
      throw new Error('boom');
    });
    const { adapter } = makeSut({
      prismaWrite: { $queryRaw: boom },
      prismaRead: { $queryRaw: boom },
      redis: { isEnabled: true, client: { ping: boom } },
      s3: { bucketName: 'b', client: { send: boom } },
    });

    const report = await adapter.check();

    expect(report.status).toBe('degraded');
  });
});
