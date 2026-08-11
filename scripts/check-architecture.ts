import { checkArchitecture } from './architecture-rules';

const violations = checkArchitecture();

if (violations.length > 0) {
  console.error(`\nArchitecture violations found (${violations.length}):\n`);
  for (const violation of violations) {
    console.error(`  ${violation.file}`);
    console.error(`    rule:    ${violation.rule}`);
    console.error(`    imports: ${violation.importPath}`);
    console.error(`    reason:  ${violation.message}\n`);
  }
  process.exit(1);
}

console.log('Architecture checks passed: dependency rules hold across all modules.');
