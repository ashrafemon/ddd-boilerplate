/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: [
    '<rootDir>/src/business/**/specifications/integrations/**/*.integration-spec.ts',
    '<rootDir>/src/business/**/specifications/**/*.api-spec.ts',
    '<rootDir>/src/business/**/specifications/**/*.security.spec.ts',
    '<rootDir>/src/business/**/specifications/**/*.contract.spec.ts',
  ],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@shared-kernel/(.*)$': '<rootDir>/src/shared-kernel/$1',
    '^@bootstrap/(.*)$': '<rootDir>/src/bootstrap/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@platform/(.*)$': '<rootDir>/src/platform/$1',
    '^@business/(.*)$': '<rootDir>/src/business/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@prisma/client$': '<rootDir>/src/generated/client.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
};
