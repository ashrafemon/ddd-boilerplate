import { recordInspectionResultSchema } from './record-inspection-result.request.dto';

describe('recordInspectionResultSchema', () => {
  it('accepts an inspection split', () => {
    expect(
      recordInspectionResultSchema.safeParse({
        lines: [
          {
            productId: '550e8400-e29b-41d4-a716-446655440000',
            acceptedQuantity: 2,
            rejectedQuantity: 1,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects an empty line set', () => {
    expect(recordInspectionResultSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it('rejects a negative quantity', () => {
    expect(
      recordInspectionResultSchema.safeParse({
        lines: [
          {
            productId: '550e8400-e29b-41d4-a716-446655440000',
            acceptedQuantity: -1,
            rejectedQuantity: 0,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
