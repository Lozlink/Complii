export interface CompliiConfig {
  apiKey: string;
  environment?: 'production' | 'staging';
  timeout?: number;
  baseUrl?: string;
}

export interface PaginatedResponse<T> {
  object: 'list';
  data: T[];
  hasMore: boolean;
  totalCount?: number;
}

export interface CompliiError {
  type: string;
  code: string;
  message: string;
  param?: string;
  requestId?: string;
}
