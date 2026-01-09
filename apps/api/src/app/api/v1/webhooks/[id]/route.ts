import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createNotFoundError, createInternalError } from '@/lib/utils/errors';

function formatWebhook(webhook: Record<string, unknown>) {
  return {
    id: `whk_${(webhook.id as string)}`,
    object: 'webhook_endpoint',
    url: webhook.url,
    events: webhook.events,
    description: webhook.description,
    status: webhook.status,
    createdAt: webhook.created_at,
    updatedAt: webhook.updated_at,
  };
}

function extractWebhookId(idParam: string): string {
  if (idParam.startsWith('whk_')) {
    return idParam.slice(4);
  }
  return idParam;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const webhookId = extractWebhookId(id);

      const { data: webhook, error } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .ilike('id', `${webhookId}%`)
        .single();

      if (error || !webhook) {
        return createNotFoundError('Webhook');
      }

      return NextResponse.json(formatWebhook(webhook));
    } catch (error) {
      console.error('Webhook get error:', error);
      return createInternalError('Failed to get webhook');
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const body = await req.json();
      const supabase = getServiceClient();

      const webhookId = extractWebhookId(id);

      const updates: Record<string, unknown> = {};
      if (body.url !== undefined) updates.url = body.url;
      if (body.events !== undefined) updates.events = body.events;
      if (body.description !== undefined) updates.description = body.description;
      if (body.status !== undefined) updates.status = body.status;

      const { data: webhook, error } = await supabase
        .from('webhook_endpoints')
        .update(updates)
        .eq('tenant_id', tenant.tenantId)
        .ilike('id', `${webhookId}%`)
        .select()
        .single();

      if (error || !webhook) {
        return createNotFoundError('Webhook');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'webhook_updated',
        entity_type: 'webhook',
        entity_id: webhook.id,
        description: `Updated webhook endpoint`,
        metadata: { updatedFields: Object.keys(updates) },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(formatWebhook(webhook));
    } catch (error) {
      console.error('Webhook update error:', error);
      return createInternalError('Failed to update webhook');
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const webhookId = extractWebhookId(id);

      const { data: webhook, error } = await supabase
        .from('webhook_endpoints')
        .delete()
        .eq('tenant_id', tenant.tenantId)
        .ilike('id', `${webhookId}%`)
        .select('id')
        .single();

      if (error || !webhook) {
        return createNotFoundError('Webhook');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'webhook_deleted',
        entity_type: 'webhook',
        entity_id: webhook.id,
        description: `Deleted webhook endpoint`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        id: `whk_${webhook.id}`,
        object: 'webhook_endpoint',
        deleted: true,
      });
    } catch (error) {
      console.error('Webhook delete error:', error);
      return createInternalError('Failed to delete webhook');
    }
  });
}
