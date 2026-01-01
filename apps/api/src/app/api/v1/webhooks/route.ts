import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createValidationError, createInternalError } from '@/lib/utils/errors';
import crypto from 'crypto';

const VALID_EVENTS = [
  'customer.created',
  'transaction.created',
  'transaction.flagged',
  'transaction.ttr_required',
  'screening.match',
  'risk.high',
];

interface WebhookCreateBody {
  url: string;
  events: string[];
  description?: string;
}

function formatWebhook(webhook: Record<string, unknown>, includeSecret = false) {
  return {
    id: `whk_${(webhook.id as string).slice(0, 8)}`,
    object: 'webhook_endpoint',
    url: webhook.url,
    events: webhook.events,
    description: webhook.description,
    status: webhook.status,
    ...(includeSecret && { secret: webhook.secret }),
    createdAt: webhook.created_at,
    updatedAt: webhook.updated_at,
  };
}

function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body: WebhookCreateBody = await req.json();

      if (!body.url) {
        return createValidationError('url', 'url is required');
      }

      try {
        new URL(body.url);
      } catch {
        return createValidationError('url', 'url must be a valid URL');
      }

      if (!body.url.startsWith('https://')) {
        return createValidationError('url', 'url must use HTTPS');
      }

      if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
        return createValidationError('events', 'events must be a non-empty array');
      }

      const invalidEvents = body.events.filter((e) => !VALID_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return createValidationError(
          'events',
          `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${VALID_EVENTS.join(', ')}`
        );
      }

      const { tenant } = req;
      const supabase = getServiceClient();
      const secret = generateWebhookSecret();

      const { data: webhook, error } = await supabase
        .from('webhook_endpoints')
        .insert({
          tenant_id: tenant.tenantId,
          url: body.url,
          events: body.events,
          description: body.description,
          secret,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error('Webhook create error:', error);
        return createInternalError('Failed to create webhook');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'webhook_created',
        entity_type: 'webhook',
        entity_id: webhook.id,
        description: `Created webhook endpoint for ${body.url}`,
        metadata: { events: body.events },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      // Include secret only on creation
      return NextResponse.json(formatWebhook(webhook, true), { status: 201 });
    } catch (error) {
      console.error('Webhook create error:', error);
      return createInternalError('Failed to create webhook');
    }
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);

      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

      const { data: webhooks, error, count } = await supabase
        .from('webhook_endpoints')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Webhook list error:', error);
        return createInternalError('Failed to list webhooks');
      }

      return NextResponse.json({
        object: 'list',
        data: (webhooks || []).map((w) => formatWebhook(w)),
        totalCount: count,
      });
    } catch (error) {
      console.error('Webhook list error:', error);
      return createInternalError('Failed to list webhooks');
    }
  });
}
