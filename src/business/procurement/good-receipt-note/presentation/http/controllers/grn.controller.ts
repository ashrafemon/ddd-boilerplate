import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CreateGrnUseCase } from '../application/usecase';
import { AddGrnLineUseCase } from '../application/usecase';
import { ReceiveGrnUseCase } from '../application/usecase';
import { CompleteGrnUseCase } from '../application/usecase';
import { GrnId } from '../domain/value-objects';
import { CreateGrnRequest } from '../domain/types';
import { AddGrnLineRequest } from '../domain/types';
import { JwtAuthGuard } from '@infrastructure/auth/guards';

@Controller('grn')
export class GrnController {
  constructor(
    private readonly createGrnUseCase: CreateGrnUseCase,
    private readonly addGrnLineUseCase: AddGrnLineUseCase,
    private readonly receiveGrnUseCase: ReceiveGrnUseCase,
    private readonly completeGrnUseCase: CompleteGrnUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() request: CreateGrnRequest) {
    return this.createGrnUseCase.execute(request);
  }

  @Post(':id/lines')
  @UseGuards(JwtAuthGuard)
  async addLine(@Param('id') id: string, @Body() request: AddGrnLineRequest) {
    return this.addGrnLineUseCase.execute({ ...request, id });
  }

  @Post(':id/receive')
  @UseGuards(JwtAuthGuard)
  async receive(@Param('id') id: string) {
    return this.receiveGrnUseCase.execute({ id });
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  async complete(@Param('id') id: string) {
    return this.completeGrnUseCase.execute(id);
  }
}