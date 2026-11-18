import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RegisterSagaDefinitionUseCase } from '../use-cases/register-saga-definition.usecase';
import { ListSagaDefinitionsUseCase } from '../use-cases/list-saga-definitions.usecase';
import { SetSagaDefinitionStatusUseCase } from '../use-cases/set-saga-definition-status.usecase';
import { ValidateActiveSagaDefinitionsUseCase } from '../use-cases/validate-active-saga-definitions.usecase';
import { SagaDefinitionStatus } from '../types/saga.types';
import { SagaDefinitionDocument } from '../types/saga-definition.document';
import { PublishSagaDefinitionDto } from './requests/publish-saga-definition.request.dto';
import { ListSagaDefinitionsDto } from './requests/list-saga-definitions.request.dto';
import { SetSagaDefinitionStatusDto } from './requests/set-saga-definition-status.request.dto';

/**
 * Runtime saga definitions — the only way a saga enters the engine.
 *
 * Nothing is compiled in and nothing is seeded: a definition is published here
 * (validated against the document schema, normalised, and rejected if it could
 * not execute), read back by the router from `saga_definitions`, and retired when
 * superseded. Instances keep the plan snapshot they started with, so publishing
 * or retiring never rewrites running work.
 */
@ApiTags('saga')
@ApiBearerAuth()
@Controller('saga/definitions')
export class SagaDefinitionController {
  constructor(
    private readonly publish: RegisterSagaDefinitionUseCase,
    private readonly list: ListSagaDefinitionsUseCase,
    private readonly setStatus: SetSagaDefinitionStatusUseCase,
    private readonly validateActive: ValidateActiveSagaDefinitionsUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Publish a saga definition (idempotent per key + version)' })
  async publishDefinition(@Body() dto: PublishSagaDefinitionDto) {
    const data = await this.publish.execute({
      // The Zod DTO is a structural subset of the document; the parser is the
      // authority on the full shape and normalises aliases.
      document: dto.document as unknown as SagaDefinitionDocument,
      ownerModule: dto.ownerModule ?? null,
      status: dto.status === 'DRAFT' ? SagaDefinitionStatus.DRAFT : SagaDefinitionStatus.ACTIVE,
    });
    return { data, message: 'Saga definition published' };
  }

  @Get()
  @ApiOperation({ summary: 'List definitions in any status' })
  async listDefinitions(@Query() query: ListSagaDefinitionsDto) {
    const data = await this.list.execute({
      status: query.status as SagaDefinitionStatus | undefined,
      sagaKey: query.sagaKey,
    });
    return { data, message: 'Saga definitions' };
  }

  @Post('validate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Re-validate every ACTIVE definition and mark broken ones INVALID' })
  async validateDefinitions() {
    const data = await this.validateActive.execute();
    return { data, message: 'Active saga definitions validated' };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or retire one definition' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSagaDefinitionStatusDto,
  ) {
    const data = await this.setStatus.execute({
      definitionId: id,
      status: SagaDefinitionStatus[dto.status],
    });
    return { data, message: `Saga definition ${dto.status}` };
  }
}
