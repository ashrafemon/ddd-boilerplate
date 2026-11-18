import { redactChanges } from './audit.types';

describe('redactChanges', () => {
  it('returns undefined when there is nothing to record', () => {
    expect(redactChanges(undefined)).toBeUndefined();
  });

  it('replaces credential-shaped fields wholesale, whatever their value type', () => {
    const redacted = redactChanges({
      password: 'hunter2',
      apiToken: 'abc',
      nestedSecret: { deep: true },
      authorization: 'Bearer x',
      otp: 123456,
    });

    expect(redacted).toEqual({
      password: '[redacted]',
      apiToken: '[redacted]',
      nestedSecret: '[redacted]',
      authorization: '[redacted]',
      otp: '[redacted]',
    });
  });

  it('keeps ordinary fields untouched', () => {
    expect(redactChanges({ status: 'APPROVED', total: 12.5, note: 'ok' })).toEqual({
      status: 'APPROVED',
      total: 12.5,
      note: 'ok',
    });
  });

  it('truncates an oversized string but keeps short values exact', () => {
    const short = 'x'.repeat(100);
    const long = 'y'.repeat(5_000);

    const redacted = redactChanges({ short, long });

    expect(redacted?.short).toBe(short);
    expect(redacted?.long).toBe(`${'y'.repeat(4_000)}…[truncated]`);
  });

  it('passes non-string values through by reference', () => {
    const nested = { a: [1, 2, 3] };

    expect(redactChanges({ nested })?.nested).toBe(nested);
  });
});
