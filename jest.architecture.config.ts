/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/src/specifications/architecture/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@business/(.*)$': '<rootDir>/src/business/$1',
    '^@platform/(.*)$': '<rootDir>/src/platform/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@shared-kernel/(.*)$': '<rootDir>/src/shared-kernel/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@test/(.*)$': '<rootDir>/src/specifications/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
};
