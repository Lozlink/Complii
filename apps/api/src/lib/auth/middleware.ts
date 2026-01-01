import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, TenantContext } from './api-key';
import { createApiError } from '../utils/errors';

export interface AuthenticatedRequest extends NextRequest {
  tenant: TenantContext;
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return createApiError('authentication_error', 'missing_api_key', 'Missing Authorization header', 401);
  }

  if (!authHeader.startsWith('Bearer ')) {
    return createApiError('authentication_error', 'invalid_format', 'Authorization header must use Bearer scheme', 401);
  }

  const apiKey = authHeader.substring(7);
  const tenant = await validateApiKey(apiKey);

  if (!tenant) {
    return createApiError('authentication_error', 'invalid_api_key', 'Invalid API key', 401);
  }

  // Attach tenant context to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.tenant = tenant;

  return handler(authenticatedRequest);
}

export function getTenantFromRequest(request: NextRequest): TenantContext | null {
  return (request as AuthenticatedRequest).tenant || null;
}
