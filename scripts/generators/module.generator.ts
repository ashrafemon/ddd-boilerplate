/**
 * Module Generator for NestJS DDD Boilerplate
 *
 * Generates a complete business module with domain, application,
 * infrastructure, and presentation layers. Idempotent by default —
 * existing files are never overwritten unless `--force` is passed.
 *
 * Usage:
 *   npx tsx scripts/generators/module.generator.ts --config <path-to-config.ts>
 *   npx tsx scripts/generators/module.generator.ts --name product --context catalog --force
 */

import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyConfig {
  name: string;
  type: 'string' | 'text' | 'money' | 'boolean' | 'enum' | 'id';
  required?: boolean;
  maxLength?: number;
  values?: string[];
}

interface EventConfig {
  name: string;
  fields?: string[];
}

interface ModuleConfig {
  name: string;
  context: string;
  displayName: string;
  entityName: string;
  entityNamePlural: string;
  modulePath?: string;
  properties?: PropertyConfig[];
  states?: string[];
  events?: EventConfig[];
  outboundPorts?: { name: string; portName: string; method: string; returnType: string }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();

function toPascalCase(str: string): string {
  return str.replace(/(^|[-_\s])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function getModulePath(config: ModuleConfig): string {
  if (config.modulePath) return config.modulePath;
  return join(ROOT, 'src/business', config.context, config.name);
}

function ensureDir(path: string): Promise<void> {
  return mkdir(path, { recursive: true });
}

// ─── Barrel Sync ───────────────────────────────────────────────────────────

async function syncBarrel(dir: string, exclude: string[] = []): Promise<void> {
  try {
    const entries = await readdir(dir);
    const files = entries
      .filter(f => f.endsWith('.ts') && !exclude.includes(f) && !f.endsWith('.spec.ts'))
      .sort();

    const lines = files.map(f => {
      const name = f.replace(/\.ts$/, '');
      if (name === 'index') return null;
      return `export * from './${name}';`;
    }).filter(Boolean);

    const content = lines.join('\n') + '\n';
    const indexPath = join(dir, 'index.ts');

    try {
      const existing = await readFile(indexPath, 'utf-8');
      if (existing.trim() === content.trim()) return;
    } catch {
      // File doesn't exist, will be created
    }

    await writeFile(indexPath, content, 'utf-8');
  } catch {
    // Directory doesn't exist yet
  }
}

async function syncAllBarrels(modulePath: string): Promise<void> {
  const barrelDirs = [
    join(modulePath, 'domain', 'entities'),
    join(modulePath, 'domain', 'value-objects'),
    join(modulePath, 'domain', 'events'),
    join(modulePath, 'domain', 'factories'),
    join(modulePath, 'domain', 'ports'),
    join(modulePath, 'application', 'usecase'),
    join(modulePath, 'application', 'consumers'),
    join(modulePath, 'application', 'adapters'),
    join(modulePath, 'application', 'ports'),
    join(modulePath, 'application', 'ports', 'outbound'),
    join(modulePath, 'infrastructure', 'persistence'),
    join(modulePath, 'presentation', 'http', 'controllers'),
    join(modulePath, 'presentation', 'http', 'request'),
  ];

  for (const dir of barrelDirs) {
    await syncBarrel(dir);
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────

function generateModuleFile(config: ModuleConfig): string {
  const { name, context, entityName } = config;
  const moduleName = `${toPascalCase(name)}Module`;
  const kebab = toKebabCase(name);
  const camel = toCamelCase(name);

  return `import { Module } from '@nestjs/common';
import { ${entityName}Controller } from './presentation/http/controllers';
import { Create${entityName}UseCase } from './application/usecase';
import { Update${entityName}UseCase } from './application/usecase';
import { ${entityName}StatusUseCase } from './application/usecase';
import { Get${entityName}UseCase } from './application/usecase';
import { List${entityName}sUseCase } from './application/usecase';
import { ${entityName}EventEmitterConsumer } from './application/consumers';
import { ${entityName}RabbitMQConsumer } from './application/consumers';
import { ${entityName}KafkaConsumer } from './application/consumers';
import { ${entityName}SqsConsumer } from './application/consumers';
import { ${entityName}CommandRepositoryPort, ${entityName}QueryRepositoryPort } from './domain/domain-ports';
import { Prisma${entityName}CommandRepository } from './infrastructure/persistence';
import { Prisma${entityName}QueryRepository } from './infrastructure/persistence';

@Module({
  controllers: [${entityName}Controller],
  providers: [
    Create${entityName}UseCase,
    Update${entityName}UseCase,
    ${entityName}StatusUseCase,
    Get${entityName}UseCase,
    List${entityName}sUseCase,
    ${entityName}EventEmitterConsumer,
    ${entityName}RabbitMQConsumer,
    ${entityName}KafkaConsumer,
    ${entityName}SqsConsumer,
    { provide: ${entityName}CommandRepositoryPort, useClass: Prisma${entityName}CommandRepository },
    { provide: ${entityName}QueryRepositoryPort, useClass: Prisma${entityName}QueryRepository },
  ],
})
export class ${moduleName} {}
`;
}

function generateAggregate(config: ModuleConfig): string {
  const { entityName, states, properties } = config;
  const statusEnum = states?.length ? `\nexport enum ${entityName}Status {\n${states.map(s => `  ${s} = '${s}',`).join('\n')}\n}` : '';

  return `import { AggregateRoot } from '@business/shared-business/domain/bases';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { ${entityName}Id } from '../value-objects';
import {
  ${entityName}Activated,
  ${entityName}Deactivated,
  ${entityName}Updated,
} from '../events';

${statusEnum}

export interface ${entityName}Props {
  id: ${entityName}Id;
  ${properties?.map(p => `${p.name}: ${p.type === 'money' ? 'Money' : p.type === 'enum' ? 'string' : p.type};`).join('\n  ') || ''}
  status: ${states?.length ? `${entityName}Status` : 'string'};
  createdAt: Date;
  updatedAt: Date;
}

export class ${entityName} extends AggregateRoot<${entityName}Id> {
  private props: ${entityName}Props;

  private constructor(id: ${entityName}Id, props: ${entityName}Props, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static instantiate(id: ${entityName}Id, props: ${entityName}Props, version: number): ${entityName} {
    return new ${entityName}(id, props, version);
  }

${properties?.map(p => `  get ${p.name}(): ${p.type === 'money' ? 'Money' : p.type === 'enum' ? 'string' : p.type} {
    return this.props.${p.name};
  }`).join('\n\n') || ''}

  get status(): ${states?.length ? `${entityName}Status` : 'string'} {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(input: Partial<${entityName}Props>): void {
    ${properties?.filter(p => p.type !== 'id').map(p => `if (input.${p.name} !== undefined) {
      this.props.${p.name} = input.${p.name} as any;
    }`).join('\n    ') || ''}
    this.props.updatedAt = new Date();
    this.addEvent(new ${entityName}Updated(this.id));
  }

${states?.length ? `  activate(): void {
    invariantRegistry.enforce('${toKebabCase(config.name)}.status-transition', {
      status: this.props.status,
      to: ${entityName}Status.${states[0]},
    });
    this.props.status = ${entityName}Status.${states[0]};
    this.props.updatedAt = new Date();
    this.addEvent(new ${entityName}Activated(this.id));
  }

  deactivate(): void {
    invariantRegistry.enforce('${toKebabCase(config.name)}.status-transition', {
      status: this.props.status,
      to: ${entityName}Status.${states[1] || states[0]},
    });
    this.props.status = ${entityName}Status.${states[1] || states[0]};
    this.props.updatedAt = new Date();
    this.addEvent(new ${entityName}Deactivated(this.id));
  }` : ''}
}
`;
}

function generateFactory(config: ModuleConfig): string {
  const { entityName, properties, name } = config;

  return `import { DomainFactory } from '@business/shared-business/domain/bases/factory.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { ${entityName}, Create${entityName}Input, ${entityName}Props } from '../entities';
import { ${entityName}Id } from '../value-objects';
import { ${entityName}Created } from '../events';
import './../entities/${toKebabCase(name)}.invariants';
import './../policies/${toKebabCase(name)}.policy';

export class ${entityName}Factory extends DomainFactory<${entityName}, Create${entityName}Input> {
  create(input: Create${entityName}Input): ${entityName} {
    invariantRegistry.enforce('${toKebabCase(name)}.create', {
      ${properties?.map(p => `${p.name}: input.${p.name}${p.type === 'money' ? '.amount' : ''},`).join('\n      ') || ''}
    });

    const now = new Date();
    const ${toCamelCase(name)} = ${entityName}.instantiate(
      ${entityName}Id.generate(),
      {
        ${properties?.map(p => `${p.name}: input.${p.name}${p.type === 'money' ? '' : ''},`).join('\n        ') || ''}
        status: ${entityName}Status.${config.states?.[0] || 'ACTIVE'},
        createdAt: now,
        updatedAt: now,
      },
      1,
    );

    ${toCamelCase(name)}.addEvent(new ${entityName}Created(${toCamelCase(name)}.id${properties?.map(p => `, ${toCamelCase(name)}.${p.name}`).join('') || ''}));
    return ${toCamelCase(name)};
  }

  reconstitute(id: ${entityName}Id, props: ${entityName}Props, version: number): ${entityName} {
    return ${entityName}.instantiate(id, props, version);
  }
}

export const ${toCamelCase(name)}Factory = new ${entityName}Factory();
`;
}

function generateIdVO(config: ModuleConfig): string {
  const { entityName } = config;
  return `import { randomUUID } from 'crypto';

export class ${entityName}Id {
  private constructor(public readonly value: string) {}

  static fromString(value: string): ${entityName}Id {
    return new ${entityName}Id(value);
  }

  static generate(): ${entityName}Id {
    return new ${entityName}Id(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: ${entityName}Id): boolean {
    return !!other && this.value === other.value;
  }
}
`;
}

function generateVOs(config: ModuleConfig): string {
  const { properties } = config;
  const vos = properties?.filter(p => p.type !== 'id') || [];

  return vos.map(p => {
    const voName = toPascalCase(p.name);
    const voType = p.type === 'money' ? 'Money' : 'string';

    return `export class ${voName} extends ValueObject<{ value: ${voType} }> {
  private constructor(value: ${voType}) {
    super({ value });
  }

  static create(input: ${voType}): ${voName} {
    const normalized = input as string;
    return new ${voName}(normalized);
  }

  get value(): ${voType} {
    return this.props.value;
  }
}
`;
  }).join('\n\n');
}

function generateEventFile(config: ModuleConfig, eventName: string, fields: string[] = []): string {
  const { entityName } = config;
  const eventClassName = `${entityName}${eventName}`;

  return `import { DomainEvent } from '@business/shared-business/domain/bases';
import { ${entityName}Id } from '../value-objects';

export class ${eventClassName} extends DomainEvent {
  constructor(
    public readonly ${entityName.toLowerCase()}Id: ${entityName}Id,
    ${fields?.map(f => `public readonly ${f}: any,`).join('\n    ') || ''}
  ) {
    super();
  }
}
`;
}

function generateRegistryFile(config: ModuleConfig): string {
  const { entityName, name, events } = config;
  const kebab = toKebabCase(name);

  const registrations = events?.map(e => {
    const eventClassName = `${entityName}${e.name}`;
    const fields = e.fields?.map(f => `${f}: p.${f}`).join(', ') || '';
    return `domainEventRegistry.register('${eventClassName}', payload => {
  const p = payload as unknown as Record<string, unknown>;
  return new ${eventClassName}(${entityName}Id.fromString(p.${entityName.toLowerCase()}Id as string)${fields ? ', ' + fields : ''});
});`;
  }).join('\n\n') || '';

  return `import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { ${entityName}Id } from '../value-objects';
${events?.filter(e => e.name !== 'Created').map(e => {
  const eventClassName = `${entityName}${e.name}`;
  const eventFile = `${kebab}.${toKebabCase(e.name)}.event`;
  return `import { ${eventClassName} } from './${eventFile}';`;
}).join('\n') || ''}

${registrations}
`;
}

function generateInvariants(config: ModuleConfig): string {
  const { name, entityName, properties, states } = config;
  const kebab = toKebabCase(name);

  const checks = properties?.map(p => {
    if (p.required) {
      return `invariantRegistry.register<{ ${p.name}: string }>('${kebab}.create', {
  name: '${kebab}-${p.name}-required',
  check: ({ ${p.name} }) => {
    if (!${p.name}.trim()) {
      throw Object.assign(new Error('${toPascalCase(p.name)} cannot be empty'), { statusCode: 422 });
    }
  },
});`;
    }
    return null;
  }).filter(Boolean).join('\n\n') || '';

  const transitionCheck = states?.length ? `invariantRegistry.register<{ status: ${entityName}Status; to: ${entityName}Status }>('${kebab}.status-transition', {
  name: '${kebab}-valid-status-transition',
  check: ({ status, to }) => {
    if (status === to) return;
    const allowed: Record<${entityName}Status, ${entityName}Status[]> = {
${states.map(s => `      [${entityName}Status.${s}]: [],`).join('\n')}
    };
    if (!allowed[status]?.includes(to)) {
      throw Object.assign(new Error(\`Invalid ${kebab} status transition: \${status} -> \${to}\`), { statusCode: 422 });
    }
  },
});` : '';

  return `import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { ${entityName}Status } from '../entities';

${checks}

${transitionCheck}
`;
}

function generatePolicy(config: ModuleConfig): string {
  const { name, entityName, states } = config;
  const kebab = toKebabCase(name);

  return `import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { ${entityName}Status } from '../entities';

export interface ${entityName}State {
  status: ${entityName}Status;
}

policyRegistry.register<${entityName}State>('${kebab}.lifecycle', {
  name: '${kebab}-lifecycle',
  evaluate: ({ status }) => {
    if (status === ${entityName}Status.${states?.[0] || 'ACTIVE'}) {
      return true;
    }
    return false;
  },
});
`;
}

function generateCommandRepositoryPort(config: ModuleConfig): string {
  const { entityName, name } = config;
  return `import { ${entityName} } from '../entities';
import { ${entityName}Id } from '../value-objects';

export abstract class ${entityName}CommandRepositoryPort {
  abstract save(${toCamelCase(name)}: ${entityName}): Promise<${entityName}>;
  abstract update(${toCamelCase(name)}: ${entityName}): Promise<${entityName}>;
}
`;
}

function generateQueryRepositoryPort(config: ModuleConfig): string {
  const { entityName, name } = config;
  return `import { ${entityName} } from '../entities';
import { ${entityName}Id } from '../value-objects';

export abstract class ${entityName}QueryRepositoryPort {
  abstract findById(id: ${entityName}Id): Promise<${entityName} | null>;
  abstract findAll(): Promise<${entityName}[]>;
}
`;
}

function generateCommandRepository(config: ModuleConfig): string {
  const { entityName, name } = config;
  const camel = toCamelCase(name);
  return `import { Injectable } from '@nestjs/common';
import { ${entityName}CommandRepositoryPort } from '../domain/ports';
import { ${entityName} } from '../domain/entities';
import { ${entityName}Mapper } from './${camel}.mapper';
import { PrismaService } from '@infrastructure/prisma';

@Injectable()
export class Prisma${entityName}CommandRepository extends ${entityName}CommandRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ${entityName}Mapper,
  ) {}

  async save(${camel}: ${entityName}): Promise<${entityName}> {
    const data = this.mapper.toPersistence(${camel});
    const saved = await this.prisma.${toKebabCase(name)}.create({ data });
    return this.mapper.toDomain(saved);
  }

  async update(${camel}: ${entityName}): Promise<${entityName}> {
    const data = this.mapper.toPersistence(${camel});
    const updated = await this.prisma.${toKebabCase(name)}.update({
      where: { id: ${camel}.id.toString() },
      data,
    });
    return this.mapper.toDomain(updated);
  }
}
`;
}

function generateQueryRepository(config: ModuleConfig): string {
  const { entityName, name } = config;
  const camel = toCamelCase(name);
  return `import { Injectable } from '@nestjs/common';
import { ${entityName}QueryRepositoryPort } from '../domain/ports';
import { ${entityName} } from '../domain/entities';
import { ${entityName}Id } from '../domain/value-objects';
import { ${entityName}Mapper } from './${camel}.mapper';
import { PrismaService } from '@infrastructure/prisma';

@Injectable()
export class Prisma${entityName}QueryRepository extends ${entityName}QueryRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ${entityName}Mapper,
  ) {}

  async findById(id: ${entityName}Id): Promise<${entityName} | null> {
    const record = await this.prisma.${toKebabCase(name)}.findUnique({
      where: { id: id.toString() },
    });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findAll(): Promise<${entityName}[]> {
    const records = await this.prisma.${toKebabCase(name)}.findMany();
    return records.map(r => this.mapper.toDomain(r));
  }
}
`;
}

function generateMapper(config: ModuleConfig): string {
  const { entityName, name, properties } = config;
  const camel = toCamelCase(name);
  return `import { Injectable } from '@nestjs/common';
import { ${entityName} } from '../domain/entities';
import { ${entityName}Id } from '../domain/value-objects';

@Injectable()
export class ${entityName}Mapper {
  toDomain(record: any): ${entityName} {
    return ${entityName}.instantiate(
      ${entityName}Id.fromString(record.id),
      {
        ${properties?.map(p => `${p.name}: record.${p.name},`).join('\n        ') || ''}
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      record.version ?? 1,
    );
  }

  toPersistence(${camel}: ${entityName}): any {
    return {
      ${properties?.map(p => `${p.name}: ${camel}.${p.name},`).join('\n      ') || ''}
      status: ${camel}.status,
      createdAt: ${camel}.createdAt,
      updatedAt: ${camel}.updatedAt,
    };
  }
}
`;
}

function generateController(config: ModuleConfig): string {
  const { entityName, name, entityNamePlural } = config;
  const camel = toCamelCase(name);
  return `import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Create${entityName}UseCase } from '../application/usecase';
import { Update${entityName}UseCase } from '../application/usecase';
import { Get${entityName}UseCase } from '../application/usecase';
import { List${entityName}sUseCase } from '../application/usecase';
import { Create${entityName}Input, Update${entityName}Input } from './request';

@ApiTags('${toKebabCase(name)}')
@Controller('api/v1/${toKebabCase(name)}s')
export class ${entityName}Controller {
  constructor(
    private readonly createUseCase: Create${entityName}UseCase,
    private readonly updateUseCase: Update${entityName}UseCase,
    private readonly getUseCase: Get${entityName}UseCase,
    private readonly listUseCase: List${entityName}sUseCase,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get ${name} by ID' })
  @ApiResponse({ status: 200, description: '${entityName} found' })
  @ApiResponse({ status: 404, description: '${entityName} not found' })
  async getOne(@Param('id') id: string) {
    return this.getUseCase.execute({ id });
  }

  @Get()
  @ApiOperation({ summary: 'List all ${entityNamePlural}' })
  @ApiResponse({ status: 200, description: 'List returned' })
  async list() {
    return this.listUseCase.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Create ${name}' })
  @ApiResponse({ status: 201, description: '${entityName} created' })
  async create(@Body() input: Create${entityName}Input) {
    return this.createUseCase.execute(input);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update ${name}' })
  @ApiResponse({ status: 200, description: '${entityName} updated' })
  async update(@Param('id') id: string, @Body() input: Update${entityName}Input) {
    return this.updateUseCase.execute({ id, ...input });
  }
}
`;
}

function generateCreateUseCase(config: ModuleConfig): string {
  const { entityName, name, properties } = config;
  const camel = toCamelCase(name);
  return `import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { ${toCamelCase(name)}Factory } from '../../domain/factories';
import { ${entityName}Id } from '../../domain/value-objects';
import {
  ${entityName}CommandRepositoryPort,
} from '../../domain/domain-ports';

export interface Create${entityName}Input {
  ${properties?.map(p => `${p.name}: ${p.type === 'money' ? 'number' : p.type === 'enum' ? 'string' : p.type};`).join('\n  ') || ''}
}

@Injectable()
export class Create${entityName}UseCase {
  constructor(
    @Inject(${entityName}CommandRepositoryPort)
    private readonly ${camel}Repository: ${entityName}CommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: Create${entityName}Input): Promise<${entityName}Id> {
    await this.companyConfig.getCompanyConfig();

    const ${camel} = ${toCamelCase(name)}Factory.create(input);

    await this.${camel}Repository.save(${camel});

    for (const event of ${camel}.pullEvents()) {
      await this.outboxWriter.append(event, '${entityName}', ${camel}.id.toString());
    }

    return ${camel}.id;
  }
}
`;
}

function generateUpdateUseCase(config: ModuleConfig): string {
  const { entityName, name, properties } = config;
  const camel = toCamelCase(name);
  return `import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { ${entityName}Id } from '../../domain/value-objects';
import {
  ${entityName}CommandRepositoryPort,
} from '../../domain/domain-ports';

export interface Update${entityName}Input {
  id: string;
  ${properties?.filter(p => p.name !== 'id').map(p => `${p.name}?: ${p.type === 'money' ? 'number' : p.type === 'enum' ? 'string' : p.type};`).join('\n  ') || ''}
}

@Injectable()
export class Update${entityName}UseCase {
  constructor(
    @Inject(${entityName}CommandRepositoryPort)
    private readonly ${camel}Repository: ${entityName}CommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: Update${entityName}Input): Promise<${entityName}Id> {
    await this.companyConfig.getCompanyConfig();

    const id = ${entityName}Id.fromString(input.id);
    const ${camel} = await this.${camel}Repository.findById(id);
    if (!${camel}) {
      throw new NotFoundException('${entityName} not found');
    }

    ${camel}.update({ ${properties?.filter(p => p.name !== 'id').map(p => `${p.name}: input.${p.name}`).join(', ') || ''} });
    await this.${camel}Repository.update(${camel});

    for (const event of ${camel}.pullEvents()) {
      await this.outboxWriter.append(event, '${entityName}', ${camel}.id.toString());
    }

    return ${camel}.id;
  }
}
`;
}

function generateGetUseCase(config: ModuleConfig): string {
  const { entityName, name } = config;
  const camel = toCamelCase(name);
  return `import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ${entityName}Id } from '../../domain/value-objects';
import {
  ${entityName}QueryRepositoryPort,
} from '../../domain/domain-ports';

export interface Get${entityName}Input {
  id: string;
}

@Injectable()
export class Get${entityName}UseCase {
  constructor(
    @Inject(${entityName}QueryRepositoryPort)
    private readonly ${camel}Repository: ${entityName}QueryRepositoryPort,
  ) {}

  async execute(input: Get${entityName}Input): Promise<${entityName}> {
    const id = ${entityName}Id.fromString(input.id);
    const ${camel} = await this.${camel}Repository.findById(id);
    if (!${camel}) {
      throw new NotFoundException('${entityName} not found');
    }
    return ${camel};
  }
}
`;
}

function generateListUseCase(config: ModuleConfig): string {
  const { entityName, name } = config;
  const camel = toCamelCase(name);
  return `import { Inject, Injectable } from '@nestjs/common';
import {
  ${entityName}QueryRepositoryPort,
} from '../../domain/domain-ports';

export interface List${entityName}sInput {}

@Injectable()
export class List${entityName}sUseCase {
  constructor(
    @Inject(${entityName}QueryRepositoryPort)
    private readonly ${camel}Repository: ${entityName}QueryRepositoryPort,
  ) {}

  async execute(): Promise<${entityName}[]> {
    return this.${camel}Repository.findAll();
  }
}
`;
}

function generateConsumer(config: ModuleConfig, broker: string): string {
  const { entityName, name } = config;
  const camel = toCamelCase(name);
  const brokerClass = broker === 'event-emitter' ? 'EventEmitter' : broker === 'kafka' ? 'Kafka' : broker === 'rabbitmq' ? 'RabbitMQ' : 'Sqs';

  return `import { Injectable, Logger } from '@nestjs/common';
import { ${entityName}Created } from '../../domain/events';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ${entityName}${brokerClass}Consumer {
  private readonly logger = new Logger(${entityName}${brokerClass}Consumer.name);

  @OnEvent('${entityName}Created')
  on${entityName}Created(event: ${entityName}Created): void {
    this.logger.log(\`[${brokerClass}] ${entityName} \${event.${camel}Id.toString()} created\`);
  }
}
`;
}

function generateRequestDtos(config: ModuleConfig): string {
  const { entityName, properties } = config;

  return `export interface Create${entityName}Request {
  ${properties?.map(p => `${p.name}: ${p.type === 'money' ? 'number' : p.type === 'enum' ? 'string' : p.type};`).join('\n  ') || ''}
}

export interface Update${entityName}Request {
  ${properties?.filter(p => p.name !== 'id').map(p => `${p.name}?: ${p.type === 'money' ? 'number' : p.type === 'enum' ? 'string' : p.type};`).join('\n  ') || ''}
}
`;
}

// ─── Main Generator ────────────────────────────────────────────────────────

async function generateModule(config: ModuleConfig, force: boolean = false): Promise<void> {
  const modulePath = getModulePath(config);
  const { name, entityName } = config;
  const camel = toCamelCase(name);
  const kebab = toKebabCase(name);

  console.log(`\n🏗️  Generating module: ${config.displayName} at ${modulePath}`);

  const dirs = [
    `${modulePath}/domain/entities`,
    `${modulePath}/domain/value-objects`,
    `${modulePath}/domain/events`,
    `${modulePath}/domain/factories`,
    `${modulePath}/domain/invariants`,
    `${modulePath}/domain/policies`,
    `${modulePath}/domain/ports`,
    `${modulePath}/application/usecase`,
    `${modulePath}/application/consumers`,
    `${modulePath}/application/adapters`,
    `${modulePath}/application/ports`,
    `${modulePath}/application/ports/outbound`,
    `${modulePath}/infrastructure/persistence`,
    `${modulePath}/presentation/http/controllers`,
    `${modulePath}/presentation/http/request`,
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }

  const files: Record<string, string> = {
    [`${modulePath}/${kebab}.module.ts`]: generateModuleFile(config),

    // Root index.ts is hand-written and never overwritten
    [`${modulePath}/index.ts`]: `export * from './${kebab}.module';\nexport * from './domain/entities';\nexport * from './domain/value-objects';\nexport * from './domain/events';\nexport * from './domain/factories';\nexport * from './domain/ports';\nexport * from './application/usecase';\nexport * from './application/consumers';\nexport * from './application/adapters';\nexport * from './infrastructure/persistence';\n`,

    [`${modulePath}/domain/entities/${entityName.toLowerCase()}.aggregate.ts`]: generateAggregate(config),
    [`${modulePath}/domain/entities/${entityName.toLowerCase()}.aggregate.spec.ts`]: `import { ${entityName}Status } from './${entityName.toLowerCase()}.aggregate';\nimport { ${entityName}Created } from '../events';\nimport { ${camel}Factory } from '../factories';\n\ndescribe('${entityName} aggregate', () => {\n  it('creates a ${name}', () => {\n    const ${camel} = ${camel}Factory.create({ /* TODO: add test input */ });\n    expect(${camel}).toBeDefined();\n  });\n});\n`,
    [`${modulePath}/domain/entities/${kebab}.invariants.ts`]: generateInvariants(config),

    [`${modulePath}/domain/value-objects/${entityName.toLowerCase()}-id.vo.ts`]: generateIdVO(config),
    [`${modulePath}/domain/value-objects/${kebab}.vos.ts`]: generateVOs(config),

    [`${modulePath}/domain/events/${kebab}.registry.ts`]: generateRegistryFile(config),
    ...(config.events?.reduce((acc, e) => {
      acc[`${modulePath}/domain/events/${kebab}.${toKebabCase(e.name)}.event.ts`] = generateEventFile(config, e.name, e.fields);
      return acc;
    }, {} as Record<string, string>) || {}),

    [`${modulePath}/domain/factories/${entityName.toLowerCase()}.factory.ts`]: generateFactory(config),

    [`${modulePath}/domain/policies/${kebab}.policy.ts`]: generatePolicy(config),

    [`${modulePath}/domain/ports/${kebab}-command-repository.port.ts`]: generateCommandRepositoryPort(config),
    [`${modulePath}/domain/ports/${kebab}-query-repository.port.ts`]: generateQueryRepositoryPort(config),

    [`${modulePath}/infrastructure/persistence/${camel}.mapper.ts`]: generateMapper(config),
    [`${modulePath}/infrastructure/persistence/prisma-${entityName.toLowerCase()}-command.repository.ts`]: generateCommandRepository(config),
    [`${modulePath}/infrastructure/persistence/prisma-${entityName.toLowerCase()}-query.repository.ts`]: generateQueryRepository(config),

    [`${modulePath}/application/usecase/create-${name}.usecase.ts`]: generateCreateUseCase(config),
    [`${modulePath}/application/usecase/update-${name}.usecase.ts`]: generateUpdateUseCase(config),
    [`${modulePath}/application/usecase/get-${name}.usecase.ts`]: generateGetUseCase(config),
    [`${modulePath}/application/usecase/list-${name}s.usecase.ts`]: generateListUseCase(config),

    [`${modulePath}/application/consumers/${camel}.event-emitter.consumer.ts`]: generateConsumer(config, 'event-emitter'),
    [`${modulePath}/application/consumers/${camel}.kafka.consumer.ts`]: generateConsumer(config, 'kafka'),
    [`${modulePath}/application/consumers/${camel}.rabbitmq.consumer.ts`]: generateConsumer(config, 'rabbitmq'),
    [`${modulePath}/application/consumers/${camel}.sqs.consumer.ts`]: generateConsumer(config, 'sqs'),

    [`${modulePath}/presentation/http/controllers/${camel}.controller.ts`]: generateController(config),
    [`${modulePath}/presentation/http/request/${camel}.request.ts`]: generateRequestDtos(config),
  };

  let created = 0;
  let skipped = 0;

  for (const [filePath, content] of Object.entries(files)) {
    const isRootIndex = filePath === `${modulePath}/index.ts`;
    
    try {
      const existing = await readFile(filePath, 'utf-8');
      if (isRootIndex) {
        skipped++;
        continue;
      }
      if (!force && existing.trim() === content.trim()) {
        skipped++;
        continue;
      }
      if (!force) {
        console.log(`  ⏭️  Skipping existing file: ${relative(ROOT, filePath)} (use --force to overwrite)`);
        skipped++;
        continue;
      }
    } catch {
      // File doesn't exist, create it
    }

    await writeFile(filePath, content, 'utf-8');
    console.log(`  ✅ Created: ${relative(ROOT, filePath)}`);
    created++;
  }

  await syncAllBarrels(modulePath);
  console.log(`\n✨ Module generation complete: ${created} created, ${skipped} skipped\n`);
}

// ─── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const forceIndex = args.indexOf('--force');
  const configIndex = args.indexOf('--config');

  const force = forceIndex !== -1;
  let configPath: string | undefined;

  if (configIndex !== -1 && args[configIndex + 1]) {
    configPath = args[configIndex + 1];
  }

  const config: ModuleConfig = configPath
    ? await import(configPath).then(m => (m.default || m.config) as ModuleConfig)
    : {
        name: 'product',
        context: 'catalog',
        displayName: 'Product',
        entityName: 'Product',
        entityNamePlural: 'Products',
        properties: [
          { name: 'sku', type: 'string', required: true },
          { name: 'name', type: 'string', required: true, maxLength: 200 },
          { name: 'unitPrice', type: 'money', required: true },
          { name: 'description', type: 'text' },
        ],
        states: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'],
        events: [
          { name: 'Created', fields: ['sku', 'name', 'unitPrice', 'currency'] },
          { name: 'Updated', fields: [] },
          { name: 'Activated', fields: [] },
          { name: 'Deactivated', fields: [] },
          { name: 'Discontinued', fields: [] },
        ],
      };

  if (!config) {
    console.error('❌ No module config provided.');
    process.exit(1);
  }

  await generateModule(config, force);
}

main().catch(err => {
  console.error('❌ Generator failed:', err);
  process.exit(1);
});
