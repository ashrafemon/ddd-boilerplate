export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

class PaginationUtils {
  static normalizePageQuery(query: Partial<PageQuery> | undefined): PageQuery {
    const page = Math.max(1, query?.page ?? DEFAULT_PAGE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query?.pageSize ?? DEFAULT_PAGE_SIZE));
    return { page, pageSize };
  }

  static buildPageResult<T>(items: T[], total: number, query: PageQuery): PageResult<T> {
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}

export function normalizePageQuery(query: Partial<PageQuery> | undefined): PageQuery {
  return PaginationUtils.normalizePageQuery(query);
}

export function buildPageResult<T>(items: T[], total: number, query: PageQuery): PageResult<T> {
  return PaginationUtils.buildPageResult(items, total, query);
}
