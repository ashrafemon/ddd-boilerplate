import {
  evaluateCondition,
  evaluateExpression,
  parseDuration,
  renderTemplate,
} from './saga-expression';

/**
 * Unit — the evaluator is a closed language.
 *
 * Definitions are data, so the only guarantee that matters is: exactly the listed
 * operators work, nothing can call a function or reach a host object, and a
 * malformed expression fails loudly instead of evaluating to `undefined`.
 */
describe('saga-expression', () => {
  const scope = {
    event: { grnId: 'grn-1', qty: 12, source: { type: 'BILL' }, items: ['A', 'B'] },
    company: { settings: { costing: 'fifo' } },
    steps: { valuate: { output: { unitCost: 4.5 } } },
  };

  it('reads dotted paths and literals', () => {
    expect(evaluateExpression('event.source.type', scope)).toBe('BILL');
    expect(evaluateExpression('steps.valuate.output.unitCost', scope)).toBe(4.5);
    expect(evaluateExpression("'literal'", scope)).toBe('literal');
    expect(evaluateExpression('true', scope)).toBe(true);
    expect(evaluateExpression('null', scope)).toBeNull();
  });

  it('compares with the six comparison operators', () => {
    expect(evaluateExpression('event.qty > 10', scope)).toBe(true);
    expect(evaluateExpression('event.qty >= 12', scope)).toBe(true);
    expect(evaluateExpression('event.qty < 12', scope)).toBe(false);
    expect(evaluateExpression('event.qty <= 11', scope)).toBe(false);
    expect(evaluateExpression("event.source.type == 'BILL'", scope)).toBe(true);
    expect(evaluateExpression("event.source.type != 'BILL'", scope)).toBe(false);
  });

  it('supports membership, arrays and negation', () => {
    expect(evaluateExpression("event.source.type in ['BILL', 'DIRECT']", scope)).toBe(true);
    expect(evaluateExpression("event.source.type in ['CASH']", scope)).toBe(false);
    expect(evaluateExpression('!(event.qty > 100)', scope)).toBe(true);
  });

  it('combines conditions with && and ||, respecting grouping', () => {
    expect(evaluateExpression('event.qty > 1 && event.qty < 20', scope)).toBe(true);
    expect(evaluateExpression("event.qty > 100 || event.source.type == 'BILL'", scope)).toBe(true);
    expect(evaluateExpression('(event.qty > 1 || false) && false', scope)).toBe(false);
  });

  it('treats an absent condition as true', () => {
    expect(evaluateCondition(undefined, scope)).toBe(true);
    expect(evaluateCondition('  ', scope)).toBe(true);
    expect(evaluateCondition('false', scope)).toBe(false);
  });

  it('renders {{ }} placeholders, empty for missing values', () => {
    expect(renderTemplate('GRN:{{event.grnId}}', scope)).toBe('GRN:grn-1');
    expect(renderTemplate('X:{{event.missing}}', scope)).toBe('X:');
    expect(renderTemplate('no placeholder', scope)).toBe('no placeholder');
  });

  it('parses ISO-8601 durations', () => {
    expect(parseDuration('P1W')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration('P7D')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration('PT30M')).toBe(30 * 60 * 1000);
    expect(parseDuration('PT45.5S')).toBe(45_500);
  });

  it('rejects a non-positive duration', () => {
    expect(() => parseDuration('P0D')).toThrow(/must be positive/);
  });

  it('throws on malformed expressions instead of evaluating them', () => {
    expect(() => evaluateExpression('event.qty >', scope)).toThrow();
    expect(() => evaluateExpression('event..qty', scope)).toThrow();
    expect(() => evaluateExpression('event.qty; drop table', scope)).toThrow();
    expect(() => evaluateExpression('event.qty +', scope)).toThrow();
  });

  it('compares mismatched types like JS rather than throwing', () => {
    // `>'` against a string is a runtime comparison, not a parse error.
    expect(evaluateExpression("event.qty > 'x'", scope)).toBe(false);
  });

  it('has no call syntax, so a reachable function is never invoked', () => {
    expect(() => evaluateExpression('event.qty.constructor()', scope)).toThrow();
    expect(() => evaluateExpression('event.qty.toString()', scope)).toThrow();
    expect(() => evaluateExpression('process.exit(1)', scope)).toThrow();
  });
});
