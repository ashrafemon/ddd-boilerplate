/**
 * Safe expression evaluator + `{{ }}` template renderer for saga definitions.
 *
 * Design 08: "linear steps, three small expressions, safe evaluator (JEXL/CEL —
 * never eval)". This is a compact hand-written scanner + recursive-descent
 * parser that supports exactly what definitions need and nothing more:
 *
 *   literals        `'x'` `"x"` `42` `1.5` `true` `false` `null`
 *   paths           `event.source.type`, `steps.valuate.output.unitCosts`
 *   arrays          `['BILL', 'DIRECT']`
 *   operators       `==` `!=` `>` `<` `>=` `<=` `!` `&&` `||` `in`
 *   grouping        `( ... )`
 *
 * Values are read from a plain scope object; there is no property assignment,
 * no function call and no host access — a malformed expression throws.
 */

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'ident'; value: string }
  | { kind: 'punct'; value: string };

const PUNCT_2 = ['&&', '||', '==', '!=', '>=', '<='];
const PUNCT_1 = ['(', ')', '[', ']', ',', '.', '!', '>', '<'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = '';
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < source.length) {
          value += source[i + 1];
          i += 2;
          continue;
        }
        value += source[i];
        i += 1;
      }
      if (i >= source.length) {
        throw new Error(`Unterminated string literal in "${source}"`);
      }
      i += 1;
      tokens.push({ kind: 'string', value });
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      let raw = '';
      while (i < source.length && /[0-9.]/.test(source[i])) {
        raw += source[i];
        i += 1;
      }
      tokens.push({ kind: 'number', value: Number(raw) });
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let raw = '';
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) {
        raw += source[i];
        i += 1;
      }
      tokens.push({ kind: 'ident', value: raw });
      continue;
    }

    const two = source.slice(i, i + 2);
    if (PUNCT_2.includes(two)) {
      tokens.push({ kind: 'punct', value: two });
      i += 2;
      continue;
    }
    if (PUNCT_1.includes(ch)) {
      tokens.push({ kind: 'punct', value: ch });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" in "${source}"`);
  }

  return tokens;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (isNullish(a) && isNullish(b)) {
    return true;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  return false;
}

function truthy(value: unknown): boolean {
  if (isNullish(value) || value === false) {
    return false;
  }
  if (value === 0 || value === '') {
    return false;
  }
  return true;
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly source: string,
    private readonly scope: Record<string, unknown>,
  ) {}

  parse(): unknown {
    const value = this.parseOr();
    if (this.pos < this.tokens.length) {
      this.fail(`unexpected token "${this.describe(this.tokens[this.pos])}"`);
    }
    return value;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.isPunct('||')) {
      this.pos += 1;
      const right = this.parseAnd();
      left = truthy(left) || truthy(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseComparison();
    while (this.isPunct('&&')) {
      this.pos += 1;
      const right = this.parseComparison();
      left = truthy(left) && truthy(right);
    }
    return left;
  }

  private parseComparison(): unknown {
    const left = this.parseUnary();
    const op = this.peekComparisonOperator();
    if (!op) {
      return left;
    }
    this.pos += 1;
    const right = this.parseUnary();
    switch (op) {
      case '==':
        return looseEq(left, right);
      case '!=':
        return !looseEq(left, right);
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case 'in':
        return Array.isArray(right) && right.some(item => looseEq(item, left));
      default:
        this.fail(`unsupported operator "${op}"`);
    }
  }

  private parseUnary(): unknown {
    if (this.isPunct('!')) {
      this.pos += 1;
      return !truthy(this.parseUnary());
    }
    return this.parsePostfix();
  }

  private parsePostfix(): unknown {
    let value = this.parsePrimary();
    while (this.isPunct('.')) {
      this.pos += 1;
      const token = this.tokens[this.pos];
      if (!token || token.kind !== 'ident') {
        this.fail('expected a property name after "."');
      }
      this.pos += 1;
      if (isNullish(value)) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[token.value];
    }
    return value;
  }

  private parsePrimary(): unknown {
    const token = this.tokens[this.pos];
    if (!token) {
      this.fail('unexpected end of expression');
    }

    if (token.kind === 'number' || token.kind === 'string') {
      this.pos += 1;
      return token.value;
    }

    if (token.kind === 'ident') {
      this.pos += 1;
      switch (token.value) {
        case 'true':
          return true;
        case 'false':
          return false;
        case 'null':
          return null;
        case 'undefined':
          return undefined;
        default:
          return this.scope[token.value];
      }
    }

    if (token.kind === 'punct' && token.value === '(') {
      this.pos += 1;
      const value = this.parseOr();
      if (!this.isPunct(')')) {
        this.fail('expected ")"');
      }
      this.pos += 1;
      return value;
    }

    if (token.kind === 'punct' && token.value === '[') {
      this.pos += 1;
      const items: unknown[] = [];
      if (!this.isPunct(']')) {
        items.push(this.parseOr());
        while (this.isPunct(',')) {
          this.pos += 1;
          items.push(this.parseOr());
        }
      }
      if (!this.isPunct(']')) {
        this.fail('expected "]"');
      }
      this.pos += 1;
      return items;
    }

    this.fail(`unexpected token "${this.describe(token)}"`);
  }

  private peekComparisonOperator(): string | null {
    const token = this.tokens[this.pos];
    if (!token) {
      return null;
    }
    if (token.kind === 'punct' && ['==', '!=', '>', '<', '>=', '<='].includes(token.value)) {
      return token.value;
    }
    if (token.kind === 'ident' && token.value === 'in') {
      return 'in';
    }
    return null;
  }

  private isPunct(value: string): boolean {
    const token = this.tokens[this.pos];
    return Boolean(token) && token.kind === 'punct' && token.value === value;
  }

  private describe(token: Token): string {
    return token.kind === 'punct' ? token.value : String(token.value);
  }

  private fail(message: string): never {
    throw new Error(`Invalid saga expression "${this.source}": ${message}`);
  }
}

/** Evaluate an expression against a scope. Throws on malformed input. */
export function evaluateExpression(source: string, scope: Record<string, unknown>): unknown {
  const trimmed = source.trim();
  if (trimmed === '') {
    return undefined;
  }
  try {
    return new Parser(tokenize(trimmed), trimmed, scope).parse();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      message.startsWith('Invalid saga expression')
        ? message
        : `Invalid saga expression "${trimmed}": ${message}`,
    );
  }
}

/** Evaluate an expression as a boolean; an absent condition is `true`. */
export function evaluateCondition(
  source: string | undefined,
  scope: Record<string, unknown>,
): boolean {
  if (source === undefined || source.trim() === '') {
    return true;
  }
  return truthy(evaluateExpression(source, scope));
}

/** Render `{{ expr }}` placeholders; missing values render as an empty string. */
export function renderTemplate(template: string, scope: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]*)\}\}/g, (_match, expression: string) => {
    const value = evaluateExpression(expression, scope);
    if (isNullish(value)) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString();
    }
    return JSON.stringify(value);
  });
}

const DURATION_PATTERN =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** Parse an ISO-8601 duration (`P7D`, `PT30M`, `P1W`) into milliseconds. */
export function parseDuration(duration: string): number {
  const match = DURATION_PATTERN.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid ISO-8601 duration "${duration}"`);
  }
  const [, weeks, days, hours, minutes, seconds] = match;
  const ms =
    Number(weeks ?? 0) * 7 * 24 * 60 * 60 * 1000 +
    Number(days ?? 0) * 24 * 60 * 60 * 1000 +
    Number(hours ?? 0) * 60 * 60 * 1000 +
    Number(minutes ?? 0) * 60 * 1000 +
    Number(seconds ?? 0) * 1000;
  if (ms <= 0) {
    throw new Error(`Duration "${duration}" must be positive`);
  }
  return ms;
}
