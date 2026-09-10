// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture-enforcing ESLint config. The `no-restricted-imports` rules
 * below make it hard to violate the dependency rules documented in
 * ARCHITECTURE.md:
 *
 *   infrastructure  third-party clients only (Prisma, brokers, cache, S3, AWS)
 *   platform        services built on those clients, exposed as ports
 *   business        talks to platform ports only, never to @infrastructure
 */

/** Aggregate modules, expressed as `<context>/<module>` under `src/business`. */
const businessModules = [
  'catalog/product',
  'party/vendor',
  'procurement/purchase-order',
  'procurement/good-receipt-note',
];

/** Paths that are private to one module and must not be reached from outside. */
const internalGroups = module => [
  [`@business/${module}/domain/**`],
  [`@business/${module}/application/queries/**`],
  [`@business/${module}/application/usecases/**`],
  [`@business/${module}/application/integrations/**`],
  [`@business/${module}/application/facades/**`],
  [`@business/${module}/infrastructure/**`],
];

/**
 * One rule block per module: it may import its own internals, another module's
 * `public/**` contract or its `application/outbound-ports/**` contract (the
 * port a producer adapter implements), but nothing else from another module —
 * and never `@infrastructure/**`.
 */
const businessBoundaryRules = businessModules.map(module => {
  const forbidden = [
    ...businessModules
      .filter(other => other !== module)
      .flatMap(other =>
        internalGroups(other).map(group => ({
          group,
          message: `@business/${module} must not import internals of @business/${other}; go through its public/ contract`,
        })),
      ),
    {
      group: ['@infrastructure/**'],
      message: `@business/${module} must depend on platform services, never on @infrastructure clients`,
    },
  ];

  return {
    files: [`src/business/${module}/**/*.ts`],
    ignores: [`src/business/${module}/public/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: forbidden,
        },
      ],
    },
  };
});

/** Broker/transport libraries are infrastructure + listener-decorator only. */
const infrastructureOnlyPaths = [
  { name: 'prisma/generated/prisma/client', message: 'Prisma is infrastructure-only' },
  { name: '@prisma/client', message: 'Prisma is infrastructure-only' },
  { name: '@prisma/adapter-pg', message: 'Prisma is infrastructure-only' },
  { name: 'amqplib', message: 'RabbitMQ libraries are infrastructure-only' },
  { name: 'kafkajs', message: 'Kafka libraries are infrastructure-only' },
  { name: 'ioredis', message: 'Redis libraries are infrastructure-only' },
  { name: 'redis', message: 'Redis libraries are infrastructure-only' },
  { name: '@golevelup/nestjs-rabbitmq', message: 'RabbitMQ is infrastructure-only' },
  { name: '@ssut/nestjs-sqs', message: 'SQS is infrastructure-only' },
  { name: '@nestjs/schedule', message: 'Scheduler belongs to platform, not business' },
];

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'prisma/generated/**', 'src/generated/**', 'dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // ------------------------------------------------------------------
  // Broker/DB/cache libraries are infrastructure-only. Listeners may use the
  // subscribe decorators, so they are carved out below.
  // ------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/infrastructure/**',
      'src/config/**',
      'src/bootstrap/**',
      'src/platform/**',
      'src/business/**/application/integrations/listeners/**',
    ],
    rules: {
      'no-restricted-imports': ['error', { paths: infrastructureOnlyPaths }],
    },
  },
  {
    files: ['src/business/**/application/integrations/listeners/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'amqplib', message: 'Use the @RabbitSubscribe decorator only' },
            { name: 'kafkajs', message: 'Use the custom @KafkaEvent decorator only' },
            { name: 'ioredis', message: 'Redis libraries are infrastructure-only' },
            { name: 'redis', message: 'Redis libraries are infrastructure-only' },
            { name: '@nestjs/schedule', message: 'Scheduler belongs to platform, not business' },
          ],
          patterns: [
            {
              group: ['@infrastructure/**'],
              message: 'Listeners must delegate to use cases, not import infrastructure clients',
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------
  // Domain code must not import NestJS at all.
  // ------------------------------------------------------------------
  {
    files: ['src/business/**/domain/**/*.ts', 'src/business/shared-business/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@nestjs/common', message: 'Domain must not depend on NestJS' },
            { name: '@nestjs/core', message: 'Domain must not depend on NestJS' },
            { name: '@nestjs/config', message: 'Domain must not depend on NestJS' },
            { name: '@nestjs/event-emitter', message: 'Domain must not depend on NestJS' },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------
  // Module-to-module boundaries (see businessBoundaryRules above).
  // ------------------------------------------------------------------
  ...businessBoundaryRules,

  // ------------------------------------------------------------------
  // shared-business must stay framework-free: no NestJS, no platform types.
  // ------------------------------------------------------------------
  {
    files: ['src/business/shared-business/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@platform/**', '@infrastructure/**', '@business/*/*/**'],
              message: 'shared-business primitives cannot depend on platform, infrastructure or a concrete module',
            },
          ],
        },
      ],
    },
  },
);
