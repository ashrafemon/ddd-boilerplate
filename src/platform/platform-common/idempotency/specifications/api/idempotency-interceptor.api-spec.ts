import { Body, Controller, Post } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { Idempotent } from '../../http/idempotent.decorator';
import { IDEMPOTENCY_HEADER } from '../../http/idempotent.decorator';
import { IdempotencyInterceptor } from '../../http/idempotency.interceptor';
import { IdempotencyPort } from '../../inbound/ports/idempotency.port';
import { IdempotencyReservation } from '../../types/idempotency.types';

/**
 * API specification — the HTTP driver of `@Idempotent()`.
 *
 * Boots a real Nest+Fastify app with the real interceptor and asserts the
 * contract the design sheet promises: header required, ACQUIRED runs once,
 * REPLAY returns the stored body without running the handler, BUSY is 409,
 * KEY_MISMATCH is 400, and a handler failure releases the claim.
 */

@Controller('probe')
class ProbeController {
  calls = 0;

  @Post()
  @Idempotent()
  create(@Body() body: { name: string }): { id: string; name: string } {
    this.calls += 1;
    return { id: 'po-1', name: body.name };
  }

  @Post('failing')
  @Idempotent()
  failing(): never {
    this.calls += 1;
    throw new Error('boom');
  }
}

const messageOf = (body: unknown): string => (body as { message?: string }).message ?? '';

const RESERVATION: IdempotencyReservation = {
  id: 'row-1',
  claimToken: 'claim-1',
  version: 1,
  tenantId: 't-1',
  companyId: 'c-1',
  scope: 'ProbeController.create',
  key: 'key-1',
};

describe('Idempotency API (@Idempotent)', () => {
  let app: NestFastifyApplication;
  const port = { reserve: jest.fn(), complete: jest.fn(), fail: jest.fn() };
  const context = { getTenantId: () => 't-1', getCompanyId: () => 'c-1' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        IdempotencyInterceptor,
        { provide: IdempotencyPort, useValue: port },
        { provide: RequestContextPort, useValue: context },
        {
          provide: ConfigService,
          useValue: { getIdempotency: () => ({ ttlMs: 60_000 }) },
        },
        Reflector,
        { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app.get(ProbeController).calls = 0;
    port.complete.mockResolvedValue(undefined);
    port.fail.mockResolvedValue(undefined);
  });

  it('rejects a decorated route without the Idempotency-Key header', async () => {
    const res = await request(app.getHttpServer()).post('/probe').send({ name: 'x' }).expect(400);
    expect(messageOf(res.body)).toContain('Idempotency-Key');
    expect(port.reserve).not.toHaveBeenCalled();
  });

  it('runs the handler once on ACQUIRED and stores the result', async () => {
    port.reserve.mockResolvedValue({ status: 'ACQUIRED', reservation: RESERVATION });

    const res = await request(app.getHttpServer())
      .post('/probe')
      .set(IDEMPOTENCY_HEADER, 'key-1')
      .send({ name: 'Acme' })
      .expect(201);

    expect(res.body).toEqual({ id: 'po-1', name: 'Acme' });
    expect(app.get(ProbeController).calls).toBe(1);
    expect(port.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't-1',
        companyId: 'c-1',
        scope: 'ProbeController.create',
        key: 'key-1',
      }),
    );
    expect(port.complete).toHaveBeenCalledWith({
      reservation: RESERVATION,
      result: { id: 'po-1', name: 'Acme' },
    });
  });

  it('replays the stored result without running the handler', async () => {
    port.reserve.mockResolvedValue({ status: 'REPLAY', result: { id: 'po-1', name: 'Acme' } });

    const res = await request(app.getHttpServer())
      .post('/probe')
      .set(IDEMPOTENCY_HEADER, 'key-1')
      .send({ name: 'Acme' })
      .expect(201);

    expect(res.body).toEqual({ id: 'po-1', name: 'Acme' });
    expect(app.get(ProbeController).calls).toBe(0);
    expect(port.complete).not.toHaveBeenCalled();
  });

  it('answers 409 while another attempt holds the claim', async () => {
    port.reserve.mockResolvedValue({ status: 'BUSY' });

    const res = await request(app.getHttpServer())
      .post('/probe')
      .set(IDEMPOTENCY_HEADER, 'key-1')
      .send({ name: 'Acme' })
      .expect(409);

    expect(messageOf(res.body)).toContain('still in progress');
    expect(app.get(ProbeController).calls).toBe(0);
  });

  it('answers 400 when the key belongs to a different payload', async () => {
    port.reserve.mockResolvedValue({ status: 'KEY_MISMATCH' });

    const res = await request(app.getHttpServer())
      .post('/probe')
      .set(IDEMPOTENCY_HEADER, 'key-1')
      .send({ name: 'Other' })
      .expect(400);

    expect(messageOf(res.body)).toContain('another request');
    expect(app.get(ProbeController).calls).toBe(0);
  });

  it('releases the claim when the handler fails', async () => {
    port.reserve.mockResolvedValue({ status: 'ACQUIRED', reservation: RESERVATION });

    await request(app.getHttpServer())
      .post('/probe/failing')
      .set(IDEMPOTENCY_HEADER, 'key-2')
      .send({})
      .expect(500);

    expect(port.fail).toHaveBeenCalledWith({ reservation: RESERVATION });
    expect(port.complete).not.toHaveBeenCalled();
  });
});
