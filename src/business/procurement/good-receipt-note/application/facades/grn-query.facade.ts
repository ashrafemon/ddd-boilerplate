import { Injectable } from '@nestjs/common';
import { GetGrnUseCase } from '../usecase/get-grn.usecase';
import { GrnQueryPort } from '../../public/ports/grn.port';
import { GrnReference } from '../../public/contracts/grn.contracts';

@Injectable()
export class GrnQueryFacade extends GrnQueryPort {
  constructor(private readonly getGrnUseCase: GetGrnUseCase) {
    super();
  }

  getGrn(id: string): Promise<GrnReference | null> {
    return this.getGrnUseCase.execute(id);
  }
}