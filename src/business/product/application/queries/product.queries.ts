import { PageQuery } from '@shared-kernal/types/pagination';

export class GetProductQuery {
  constructor(public readonly id: string) {}
}

export class ListProductsQuery {
  constructor(public readonly query: PageQuery) {}
}
