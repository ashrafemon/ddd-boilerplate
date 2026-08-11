import { PageQuery } from '@shared-kernel/types/pagination';

export class GetPurchaseOrderQuery {
  constructor(public readonly id: string) {}
}

export class ListPurchaseOrdersQuery {
  constructor(public readonly query: PageQuery) {}
}
