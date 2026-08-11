import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { zodValidationPipe } from '../../../../../shared-kernel/pipes/zod-validation.pipe';
import { CreatePurchaseOrderRequestSchema, UpdatePurchaseOrderRequestSchema } from '../request/create-purchase-order.request';
import { PurchaseOrderActionRequestSchema } from '../request/purchase-order-action.request';
import { Roles } from '../../../../../shared-kernel/http/decorator/roles.decorator';
import { CreatePurchaseOrderUseCase } from '../../../application/use-case/create-purchase-order/create-purchase-order.use-case';
import { GetPurchaseOrderUseCase } from '../../../application/use-case/get-purchase-order/get-purchase-order.use-case';
import { PurchaseOrderLifecycleFacade } from '../../../application/facade/purchase-order-lifecycle.facade';
import { SubmitPurchaseOrderUseCase } from '../../../application/use-case/submit-purchase-order/submit-purchase-order.use-case';
import { CancelPurchaseOrderUseCase, CompletePurchaseOrderUseCase, RejectPurchaseOrderUseCase } from '../../../application/use-case/purchase-order-status/purchase-order-status.use-case';
import { UpdatePurchaseOrderUseCase } from '../../../application/use-case/update-purchase-order/update-purchase-order.use-case';
import { PurchaseOrderOutput } from '../../../application/type/purchase-order.output';
import { CreatePurchaseOrderInput } from '../../../application/type/create-purchase-order.input';
import { UpdatePurchaseOrderInput } from '../../../application/type/update-purchase-order.input';

/**
 * Thin HTTP controller for the Purchase bounded context.
 */
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(
    private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase,
    private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase,
    private readonly updatePurchaseOrderUseCase: UpdatePurchaseOrderUseCase,
    private readonly submitPurchaseOrderUseCase: SubmitPurchaseOrderUseCase,
    private readonly lifecycleFacade: PurchaseOrderLifecycleFacade,
    private readonly rejectPurchaseOrderUseCase: RejectPurchaseOrderUseCase,
    private readonly cancelPurchaseOrderUseCase: CancelPurchaseOrderUseCase,
    private readonly completePurchaseOrderUseCase: CompletePurchaseOrderUseCase,
  ) {}

  @Post()
  @Roles('purchase.admin', 'purchase.manager')
  public async create(
    @Body(zodValidationPipe(CreatePurchaseOrderRequestSchema)) body: CreatePurchaseOrderInput,
  ) {
    return this.createPurchaseOrderUseCase.execute(body);
  }

  @Get(':purchaseOrderId')
  @Roles('purchase.admin', 'purchase.viewer')
  public async get(@Param('purchaseOrderId') purchaseOrderId: string): Promise<PurchaseOrderOutput> {
    return this.getPurchaseOrderUseCase.execute({ purchaseOrderId });
  }

  @Patch(':purchaseOrderId')
  @Roles('purchase.admin', 'purchase.manager')
  public async update(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body(zodValidationPipe(UpdatePurchaseOrderRequestSchema)) body: Omit<UpdatePurchaseOrderInput, 'purchaseOrderId'>,
  ) {
    return this.updatePurchaseOrderUseCase.execute({ purchaseOrderId, ...body });
  }

  @Post(':purchaseOrderId/submit')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.manager')
  public async submit(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.submitPurchaseOrderUseCase.execute({ purchaseOrderId });
  }

  @Post(':purchaseOrderId/approve')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.admin')
  public async approve(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body(zodValidationPipe(PurchaseOrderActionRequestSchema)) body: { reason?: string; approvedByUserId?: string },
  ) {
    return this.lifecycleFacade.approveAndRunPostProcessing({
      purchaseOrderId,
      approvedByUserId: body.approvedByUserId,
    });
  }

  @Post(':purchaseOrderId/reject')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.admin')
  public async reject(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body(zodValidationPipe(PurchaseOrderActionRequestSchema)) body: { reason?: string; approvedByUserId?: string },
  ) {
    return this.rejectPurchaseOrderUseCase.execute({
      purchaseOrderId,
      reason: body.reason ?? 'Rejected',
    });
  }

  @Post(':purchaseOrderId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.manager')
  public async cancel(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body(zodValidationPipe(PurchaseOrderActionRequestSchema)) body: { reason?: string; approvedByUserId?: string },
  ) {
    return this.cancelPurchaseOrderUseCase.execute({
      purchaseOrderId,
      reason: body.reason ?? 'Cancelled',
    });
  }

  @Post(':purchaseOrderId/complete')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.admin')
  public async complete(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.completePurchaseOrderUseCase.execute({ purchaseOrderId });
  }
}
