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
  'procurement/product',
  'party/vendor',
  'procurement/purchase-order',
  'procurement/good-receipt-note',
  'inventory/stock-movement',
  'sales/invoice',
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
 * Raw third-party clients. They live in `src/infrastructure` and are wrapped
 * by platform adapters; business code must go through a port.
 *
 * `@prisma/client` deserves its own message: the generated client is emitted
 * to `src/generated/` (Prisma 7 custom `output`), so the bare specifier
 * resolves at runtime to the npm stub, which requires `.prisma/client/default`
 * — a path that does not exist. The compiled app then throws
 * `Cannot find module '.prisma/client/default'` on boot. Always import the
 * generated client by its relative path (`'../../../generated/client'`).
 */
const prismaPaths = [
  {
    name: 'prisma/generated/prisma/client',
    message: 'Prisma is infrastructure-only — import the generated client by relative path',
  },
  {
    name: '@prisma/client',
    message:
      "Import the generated Prisma client by relative path ('../../../generated/client') — the bare specifier resolves to the npm stub and breaks the compiled build",
  },
  { name: '@prisma/adapter-pg', message: 'Prisma is infrastructure-only' },
];

/** Broker/cache libraries: infrastructure-only, except the platform layer. */
const transportPaths = [
  { name: 'amqplib', message: 'RabbitMQ libraries are infrastructure-only' },
  { name: 'kafkajs', message: 'Kafka libraries are infrastructure-only' },
  { name: 'ioredis', message: 'Redis libraries are infrastructure-only' },
  { name: 'redis', message: 'Redis libraries are infrastructure-only' },
  { name: '@golevelup/nestjs-rabbitmq', message: 'RabbitMQ is infrastructure-only' },
  { name: '@ssut/nestjs-sqs', message: 'SQS is infrastructure-only' },
  { name: '@nestjs/schedule', message: 'Scheduler belongs to platform, not business' },
];

/** Everything a business module (and everything under it) may never import. */
const businessRawClientPaths = [...prismaPaths, ...transportPaths];

/**
 * The platform layer may own the broker/queue clients it wraps, but never a
 * raw Prisma import and never a raw Redis/Kafka client.
 */
const platformRawClientPaths = [
  ...prismaPaths,
  { name: 'amqplib', message: 'Use the MessageQueuePort, not a raw AMQP client' },
  { name: 'kafkajs', message: 'Use the MessageQueuePort, not a raw Kafka client' },
  { name: 'ioredis', message: 'Use the infrastructure RedisService, not a raw client' },
  { name: 'redis', message: 'Use the infrastructure RedisService, not a raw client' },
];

/**
 * Listeners may import the broker packages to obtain the SUBSCRIBE DECORATORS
 * (`@RabbitSubscribe`, `@SqsMessageHandler`); they may not use the raw
 * clients behind them.
 */
const listenerRawClientPaths = [
  ...prismaPaths,
  { name: 'amqplib', message: 'Use the @RabbitSubscribe decorator only' },
  { name: 'kafkajs', message: 'Use the custom @KafkaEvent decorator only' },
  { name: 'ioredis', message: 'Redis libraries are infrastructure-only' },
  { name: 'redis', message: 'Redis libraries are infrastructure-only' },
  { name: '@nestjs/schedule', message: 'Scheduler belongs to platform, not business' },
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
          // A later config REPLACES the rule options, so the raw-client bans
          // from the base block must be restated here.
          paths: businessRawClientPaths,
          patterns: forbidden,
        },
      ],
    },
  };
});

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
  // Raw third-party clients are infrastructure-only.
  //
  // NOTE: in ESLint flat config a later config object REPLACES a rule's
  // options (it does not merge them). Every block below that sets
  // `no-restricted-imports` therefore restates the full `paths` list for its
  // scope — otherwise a narrower block would silently widen the boundary.
  //
  // ORDER MATTERS: the blocks below are applied in sequence and the LAST
  // matching one wins. They are ordered from broadest to narrowest so the
  // most specific scope (domain → listener) is the one that applies.
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
      'no-restricted-imports': ['error', { paths: businessRawClientPaths }],
    },
  },

  // ------------------------------------------------------------------
  // Module-to-module boundaries (see businessBoundaryRules above).
  // ------------------------------------------------------------------
  ...businessBoundaryRules,

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
            ...businessRawClientPaths,
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
  // Listeners are the ONE place in the business layer allowed to import a
  // broker package — to obtain the subscribe decorators. They may not use the
  // raw clients behind them, and they must delegate to use cases.
  // ------------------------------------------------------------------
  {
    files: ['src/business/**/application/integrations/listeners/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: listenerRawClientPaths,
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
  // platform is independent of business MODULES *and* the business kernel:
  // NO @business/** import is allowed (regex bans alias + relative paths).
  // Platform owns its own event contract (the structural `OutboxEvent`
  // interface in `@platform/outbox/outbox.types`) — there is no rehydrator
  // registry and no rehydration step: the outbox carries the payload verbatim.
  // ------------------------------------------------------------------
  {
    files: ['src/platform/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: platformRawClientPaths,
          patterns: [
            {
              regex: '(?:@business/|(?:\\.\\./)+business/)',
              message:
                'platform is independent of business: define a platform-owned contract and bridge it from the composition root (src/bootstrap) instead',
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------------
  // shared-business must stay framework-free: no NestJS, no platform types.
  // ------------------------------------------------------------------
  {
    files: ['src/business/shared-business/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: businessRawClientPaths,
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

  // ------------------------------------------------------------------
  // Infrastructure / config / bootstrap own the third-party clients and may
  // import anything. Stated explicitly so the boundary is intentional rather
  // than a side effect of the ignores above.
  // ------------------------------------------------------------------
  {
    files: ['src/infrastructure/**', 'src/config/**', 'src/bootstrap/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // ------------------------------------------------------------------
  // Test + script code may use any client, but never the bare
  // `@prisma/client` specifier (it breaks the compiled/runtime resolution).
  // ------------------------------------------------------------------
  {
    files: ['test/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: prismaPaths }],
    },
  },
);
