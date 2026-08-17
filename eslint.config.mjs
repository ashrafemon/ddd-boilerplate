// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture-enforcing ESLint config. The `no-restricted-imports` rules
 * below make it hard to violate the dependency rules documented in
 * ARCHITECTURE.md.
 */
export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'prisma/generated/**', 'dist/**'],
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
  // Dependency rules. Keep in sync with ARCHITECTURE.md.
  // ------------------------------------------------------------------

  // Broker/DB/cache libraries are infrastructure-only.
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/infrastructure/**',
      'src/config/**',
      'src/bootstrap/**',
      'src/platform/**',
      'src/business/**/application/consumers/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'prisma/generated/prisma/client', message: 'Prisma is infrastructure-only' },
            { name: '@prisma/client', message: 'Prisma is infrastructure-only' },
            { name: '@prisma/adapter-pg', message: 'Prisma is infrastructure-only' },
            { name: 'amqplib', message: 'RabbitMQ libraries are infrastructure-only' },
            { name: 'kafkajs', message: 'Kafka libraries are infrastructure-only' },
            { name: 'ioredis', message: 'Redis libraries are infrastructure-only' },
            { name: 'redis', message: 'Redis libraries are infrastructure-only' },
            { name: '@golevelup/nestjs-rabbitmq', message: 'RabbitMQ is infrastructure-only' },
            { name: '@nestjs/schedule', message: 'Scheduler belongs to platform, not business' },
          ],
        },
      ],
    },
  },

  // Broker subscribe decorators are allowed inside business aggregate consumer
  // classes (RabbitSubscribe, SqsMessageHandler, custom KafkaEvent).
  {
    files: ['src/business/**/application/consumers/**'],
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
        },
      ],
    },
  },

  // Domain code must not import NestJS at all.
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

  // Business code cannot import infrastructure implementations. Port
  // tokens from @infrastructure are allowed; everything else is not.
  {
    files: ['src/business/**/*.ts'],
    ignores: ['src/business/shared-business/ports/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@infrastructure/database/repositories/*'],
              message: 'Business must depend on ports, not repository implementations',
            },
            {
              group: ['@infrastructure/database/mappers/*'],
              message: 'Mappers belong to infrastructure',
            },
            {
              group: ['@infrastructure/message/*'],
              message: 'Business must not import messaging implementations',
            },
          ],
        },
      ],
    },
  },

  // Cross-module imports must go through the module root index.ts, not
  // through internal paths like domain/, application/, infrastructure/.
  // Within-module imports are still allowed.
  {
    files: ['src/business/catalog/product/**/*.ts', 'src/business/party/vendor/**/*.ts', 'src/business/supplier/vendor/**/*.ts', 'src/business/procurement/purchase/**/*.ts'],
    ignores: [
      'src/business/shared-business/**',
      'src/business/catalog/product/index.ts',
      'src/business/party/vendor/index.ts',
      'src/business/supplier/vendor/index.ts',
      'src/business/procurement/purchase/index.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@business/party/vendor/domain/**', '@business/party/vendor/application/**', '@business/party/vendor/infrastructure/**'],
              message: 'Import from @business/party/vendor (root index) instead of internal paths',
            },
            {
              group: ['@business/supplier/vendor/domain/**', '@business/supplier/vendor/application/**', '@business/supplier/vendor/infrastructure/**'],
              message: 'Import from @business/supplier/vendor (root index) instead of internal paths',
            },
            {
              group: ['@business/procurement/purchase/domain/**', '@business/procurement/purchase/application/**', '@business/procurement/purchase/infrastructure/**'],
              message: 'Import from @business/procurement/purchase (root index) instead of internal paths',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/business/party/vendor/**/*.ts', 'src/business/supplier/vendor/**/*.ts', 'src/business/procurement/purchase/**/*.ts', 'src/business/catalog/product/**/*.ts'],
    ignores: [
      'src/business/shared-business/**',
      'src/business/catalog/product/index.ts',
      'src/business/party/vendor/index.ts',
      'src/business/supplier/vendor/index.ts',
      'src/business/procurement/purchase/index.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@business/catalog/product/domain/**', '@business/catalog/product/application/**', '@business/catalog/product/infrastructure/**'],
              message: 'Import from @business/catalog/product (root index) instead of internal paths',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/business/procurement/purchase/**/*.ts', 'src/business/catalog/product/**/*.ts', 'src/business/party/vendor/**/*.ts'],
    ignores: [
      'src/business/shared-business/**',
      'src/business/catalog/product/index.ts',
      'src/business/party/vendor/index.ts',
      'src/business/supplier/vendor/index.ts',
      'src/business/procurement/purchase/index.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@business/supplier/vendor/domain/**', '@business/supplier/vendor/application/**', '@business/supplier/vendor/infrastructure/**'],
              message: 'Import from @business/supplier/vendor (root index) instead of internal paths',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/business/catalog/product/**/*.ts', 'src/business/party/vendor/**/*.ts', 'src/business/supplier/vendor/**/*.ts'],
    ignores: [
      'src/business/shared-business/**',
      'src/business/catalog/product/index.ts',
      'src/business/party/vendor/index.ts',
      'src/business/supplier/vendor/index.ts',
      'src/business/procurement/purchase/index.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@business/procurement/purchase/domain/**', '@business/procurement/purchase/application/**', '@business/procurement/purchase/infrastructure/**'],
              message: 'Import from @business/procurement/purchase (root index) instead of internal paths',
            },
          ],
        },
      ],
    },
  },

  // Domain and application-layer ports must not cross into sibling business
  // modules.
  {
    files: [
      'src/business/**/domain/**/*.ts',
      'src/business/**/application/ports/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@business/*/ports/outbound/*', '@business/*/application/ports/outbound/*'],
              message: 'Outbound ports are owned by their module; cross-module calls go through use cases resolved by ModuleRef',
            },
          ],
        },
      ],
    },
  },
);
