export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  correlationId?: string;
  timestamp: string;
  path?: string;
}

export interface ApiMeta {
  requestId?: string;
  correlationId?: string;
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
  meta?: ApiMeta;
  timestamp: string;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
  timestamp: string;
}
