import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostJournalEntryUseCase } from '../../application/use-cases/post-journal-entry.usecase';
import { CreateVendorBillUseCase } from '../../application/use-cases/create-vendor-bill.usecase';
import { SettlePayableUseCase } from '../../application/use-cases/settle-payable.usecase';
import { CreateJournalEntryDto } from './requests/create-journal-entry.request.dto';
import { CreateVendorBillDto } from './requests/create-vendor-bill.request.dto';
import { SettlePayableDto } from './requests/settle-payable.request.dto';
import { IdResponse } from './responses/id.response.dto';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly postJournalEntryUseCase: PostJournalEntryUseCase,
    private readonly createVendorBillUseCase: CreateVendorBillUseCase,
    private readonly settlePayableUseCase: SettlePayableUseCase,
  ) {}

  @Post('journal-entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a journal entry' })
  async postJournalEntry(@Body() dto: CreateJournalEntryDto): Promise<IdResponse> {
    const id = await this.postJournalEntryUseCase.execute({
      ...dto,
      postingDate: new Date(dto.postingDate),
    });
    return { id };
  }

  @Post('vendor-bills')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a vendor bill' })
  async createVendorBill(@Body() dto: CreateVendorBillDto): Promise<IdResponse> {
    const id = await this.createVendorBillUseCase.execute({
      ...dto,
      dueDate: new Date(dto.dueDate),
    });
    return { id };
  }

  @Post('settle-payable')
  @ApiOperation({ summary: 'Settle a payable' })
  async settlePayable(@Body() dto: SettlePayableDto): Promise<IdResponse> {
    const id = await this.settlePayableUseCase.execute({
      ...dto,
      paymentDate: new Date(dto.paymentDate),
    });
    return { id };
  }
}
