import { Injectable } from '@nestjs/common';
import { GetGrnUseCase } from '../usecases/get-grn.usecase';
import { GrnQueryPort, GrnReference } from '@business/procurement/good-receipt-note/public';

@Injectable()
export class GrnQueryFacade extends GrnQueryPort {
  constructor(private readonly getGrnUseCase: GetGrnUseCase) {
    super();
  }

  getGrn(id: string): Promise<GrnReference | null> {
    return this.getGrnUseCase.execute(id);
  }
}
