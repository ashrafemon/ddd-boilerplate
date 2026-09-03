import { GrnReference } from '../../public/contracts/grn.contracts';

export abstract class GrnQueryPort {
  abstract getGrn(id: string): Promise<GrnReference | null>;
}