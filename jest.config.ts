import type { Config } from 'jest';

/**
 * Single Jest configuration for the whole repository.
 *
 * Jest runs every entry in `projects` on its own; `--selectProjects <name>` runs
 * exactly one of them. The npm scripts are the supported entry points:
 *
 *   unit                      `npm test`            every `*.spec.ts` that is not
 *                                                   a specification (unit + controller
 *                                                   + dto specs), ignored by the others
 *   architecture              `npm run test:architecture`
 *   business-specifications   `npm run test:integration:business`
 *   platform-specifications   `npm run test:specifications:platform`
 *   e2e                       `npm run test:e2e`     `<flow>.e2e-spec.ts`, none yet
 *
 * `npm run test:specifications` runs both specification projects in one process.
 */

const moduleNameMapper = {
  '^@config/(.*)$': '<rootDir>/src/config/$1',
  '^@common/(.*)$': '<rootDir>/src/common/$1',
  '^@shared-kernel/(.*)$': '<rootDir>/src/shared-kernel/$1',
  '^@bootstrap/(.*)$': '<rootDir>/src/bootstrap/$1',
  '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
  '^@platform/(.*)$': '<rootDir>/src/platform/$1',
  '^@business/(.*)$': '<rootDir>/src/business/$1',
  '^@test/(.*)$': '<rootDir>/src/specifications/$1',
  '^@prisma/client$': '<rootDir>/src/generated/client.ts',
  '^(\\.{1,2}/.*)\\.js$': '$1',
};

const moduleFileExtensions = ['js', 'json', 'ts'];

const transformWith = (tsconfig: string): Config['transform'] => ({
  '^.+\\.(t|j)s$': ['ts-jest', { tsconfig }],
});

/** Options every project shares; `rootDir` is the repository root for all of them. */
const base = {
  rootDir: '.',
  moduleFileExtensions,
  testEnvironment: 'node' as const,
  moduleNameMapper,
  transform: transformWith('tsconfig.jest.json'),
};

const config: Config = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      // Specification kinds run in their own projects; unit specs live beside the source.
      testPathIgnorePatterns: [
        '\\.integration-spec\\.ts$',
        '/specifications/',
        '\\.e2e-spec\\.ts$',
      ],
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      coverageDirectory: 'coverage',
    },
    {
      ...base,
      displayName: 'architecture',
      testMatch: ['<rootDir>/src/specifications/architecture/**/*.spec.ts'],
      // Architecture specs read the repo from disk, so they compile with the real tsconfig.
      transform: transformWith('tsconfig.json'),
    },
    {
      ...base,
      displayName: 'business-specifications',
      testMatch: [
        '<rootDir>/src/business/**/specifications/integrations/**/*.integration-spec.ts',
        '<rootDir>/src/business/**/specifications/**/*.api-spec.ts',
        '<rootDir>/src/business/**/specifications/**/*.component-spec.ts',
        '<rootDir>/src/business/**/specifications/**/*.security.spec.ts',
        '<rootDir>/src/business/**/specifications/**/*.contract.spec.ts',
        '<rootDir>/src/business/**/specifications/**/*.property-spec.ts',
      ],
    },
    {
      ...base,
      displayName: 'platform-specifications',
      testMatch: [
        '<rootDir>/src/platform/**/specifications/integrations/**/*.integration-spec.ts',
        '<rootDir>/src/platform/**/specifications/**/*.api-spec.ts',
        '<rootDir>/src/platform/**/specifications/**/*.component-spec.ts',
        '<rootDir>/src/platform/**/specifications/**/*.contract.spec.ts',
        '<rootDir>/src/platform/**/specifications/**/*.security.spec.ts',
        '<rootDir>/src/platform/**/specifications/**/*.property-spec.ts',
      ],
    },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
    },
  ],
};

module.exports = config;
