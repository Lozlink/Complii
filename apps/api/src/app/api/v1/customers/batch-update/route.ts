import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// POST /v1/customers/batch-update - Batch update customers
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const body = await request.json();
      const supabase = getServiceClient();

      if (!Array.isArray(body.customers) || body.customers.length === 0) {
        return NextResponse.json(
          { error: 'customers array is required and must not be empty' },
          { status: 400 }
        );
      }

      const results = {
        updated: [] as string[],
        failed: [] as Array<{ id: string; error: string }>,
      };

      for (const update of body.customers) {
        try {
          if (!update.id) {
            results.failed.push({ id: 'unknown', error: 'Missing customer ID' });
            continue;
          }

          const customerId = update.id.startsWith('cus_')
            ? update.id.slice(4)
            : update.id;

          const updates: Record<string, unknown> = {};

          if (update.firstName !== undefined) updates.first_name = update.firstName;
          if (update.middleName !== undefined) updates.middle_name = update.middleName;
          if (update.lastName !== undefined) updates.last_name = update.lastName;
          if (update.email !== undefined) updates.email = update.email;
          if (update.phone !== undefined) updates.phone = update.phone;
          if (update.dateOfBirth !== undefined) updates.date_of_birth = update.dateOfBirth;
          if (update.residentialAddress !== undefined)
            updates.residential_address = update.residentialAddress;
          if (update.isPep !== undefined) updates.is_pep = update.isPep;
          if (update.metadata !== undefined) updates.metadata = update.metadata;

          const { data, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('tenant_id', tenant.tenantId)
            .ilike('id', `${customerId}%`)
            .select('id')
            .single();

          if (error || !data) {
            results.failed.push({
              id: update.id,
              error: error?.message || 'Customer not found',
            });
          } else {
            results.updated.push(`cus_${data.id}`);
          }
        } catch (error) {
          results.failed.push({
            id: update.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'customers_batch_updated',
        entity_type: 'customer',
        description: `Batch updated ${results.updated.length} customers`,
        metadata: { updated: results.updated.length, failed: results.failed.length },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'batch_update_result',
        updated: results.updated,
        failed: results.failed,
        summary: {
          total: body.customers.length,
          succeeded: results.updated.length,
          failed: results.failed.length,
        },
      });
    } catch (error) {
      console.error('Batch update error:', error);
      return NextResponse.json(
        { error: 'Failed to batch update customers' },
        { status: 500 }
      );
    }
  });
}
