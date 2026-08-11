import { checkArchitecture } from '../../scripts/architecture-rules';

/**
 * Architectural boundary enforcement:
 *   - domain cannot import infrastructure/prisma/NestJS core/brokers/aws
 *   - application cannot import infrastructure/prisma/ModuleRef
 *   - presentation cannot import domain/infrastructure
 *   - modules cannot import other modules directly (only outbound adapters may
 *     import the provider module's application ports)
 *   - shared layers stay independent of business modules
 */
describe('Architecture dependency rules', () => {
  it('holds for the whole src tree', () => {
    const violations = checkArchitecture();
    if (violations.length > 0) {
      const rendered = violations
        .map(
          (v) =>
            `${v.file}\n  rule: ${v.rule}\n  imports: ${v.importPath}\n  ${v.message}`,
        )
        .join('\n\n');
      console.error(`Architecture violations:\n${rendered}`);    }
    expect(violations).toHaveLength(0);
  });
});
