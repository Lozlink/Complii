import { NextResponse } from 'next/server';

export type ErrorType =
  | 'authentication_error'
  | 'authorization_error'
  | 'invalid_request_error'
  | 'rate_limit_error'
  | 'not_found_error'
  | 'api_error';

export interface ApiError {
  type: ErrorType;
  code: string;
  message: string;
  param?: string;
  requestId?: string;
}

const STATUS_CODES: Record<ErrorType, number> = {
  authentication_error: 401,
  authorization_error: 403,
  invalid_request_error: 400,
  rate_limit_error: 429,
  not_found_error: 404,
  api_error: 500,
};

export function createApiError(
  type: ErrorType,
  code: string,
  message: string,
  status?: number,
  param?: string
): NextResponse {
  const requestId = generateRequestId();
  const statusCode = status || STATUS_CODES[type];

  const errorResponse: { error: ApiError } = {
    error: {
      type,
      code,
      message,
      requestId,
      ...(param && { param }),
    },
  };

  return NextResponse.json(errorResponse, { status: statusCode });
}

export function createValidationError(param: string, message: string): NextResponse {
  return createApiError(
    'invalid_request_error',
    'validation_error',
    message,
    400,
    param
  );
}

export function createNotFoundError(resource: string): NextResponse {
  return createApiError(
    'not_found_error',
    'resource_not_found',
    `${resource} not found`,
    404
  );
}

export function createInternalError(message = 'An unexpected error occurred'): NextResponse {
  return createApiError('api_error', 'internal_error', message, 500);
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
}

export class CompliiError extends Error {
  constructor(
    public readonly type: ErrorType,
    public readonly code: string,
    message: string,
    public readonly param?: string
  ) {
    super(message);
    this.name = 'CompliiError';
  }

  toResponse(): NextResponse {
    return createApiError(this.type, this.code, this.message, undefined, this.param);
  }
}
