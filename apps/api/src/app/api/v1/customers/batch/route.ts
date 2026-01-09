import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createValidationError, createInternalError } from '@/lib/utils/errors';

interface CustomerBatchInput {
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  externalId?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  phone?: string;
  metadata?: Record<string, unknown>;
}

interface BatchResult {
  externalId?: string;
  email: string;
  id?: string;
  status: 'created' | 'exists' | 'failed';
  error?: string;
}

const MAX_BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const customers: CustomerBatchInput[] = body.customers;

      if (!customers || !Array.isArray(customers)) {
        return createValidationError('customers', 'customers must be an array');
      }

      if (customers.length === 0) {
        return createValidationError('customers', 'customers array cannot be empty');
      }

      if (customers.length > MAX_BATCH_SIZE) {
        return createValidationError(
          'customers',
          `Maximum batch size is ${MAX_BATCH_SIZE} customers`
        );
      }

      // Validate each customer has required email
      for (let i = 0; i < customers.length; i++) {
        if (!customers[i].email) {
          return createValidationError(`customers[${i}].email`, 'email is required');
        }
      }

      const { tenant } = req;
      const supabase = getServiceClient();

      const results: BatchResult[] = [];
      let succeeded = 0;
      let failed = 0;

      // Process each customer
      for (const customer of customers) {
        try {
          // Check if customer with externalId already exists
          if (customer.externalId) {
            const { data: existing } = await supabase
              .from('customers')
              .select('id')
              .eq('tenant_id', tenant.tenantId)
              .eq('external_id', customer.externalId)
              .single();

            if (existing) {
              results.push({
                externalId: customer.externalId,
                email: customer.email,
                id: `cus_${existing.id}`,
                status: 'exists',
              });
              succeeded++;
              continue;
            }
          }

          // Create customer
          const { data: created, error } = await supabase
            .from('customers')
            .insert({
              tenant_id: tenant.tenantId,
              email: customer.email,
              first_name: customer.firstName,
              middle_name: customer.middleName,
              last_name: customer.lastName,
              date_of_birth: customer.dateOfBirth,
              external_id: customer.externalId,
              residential_address: customer.address,
              phone: customer.phone,
              metadata: customer.metadata || {},
            })
            .select('id')
            .single();

          if (error) {
            results.push({
              externalId: customer.externalId,
              email: customer.email,
              status: 'failed',
              error: error.message,
            });
            failed++;
          } else {
            results.push({
              externalId: customer.externalId,
              email: customer.email,
              id: `cus_${created.id}`,
              status: 'created',
            });
            succeeded++;
          }
        } catch (err) {
          results.push({
            externalId: customer.externalId,
            email: customer.email,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          failed++;
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'customers_batch_created',
        entity_type: 'customer',
        description: `Batch created ${succeeded} customers (${failed} failed)`,
        metadata: { succeeded, failed, total: customers.length },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'batch_result',
        succeeded,
        failed,
        total: customers.length,
        results,
      });
    } catch (error) {
      console.error('Batch customer create error:', error);
      return createInternalError('Failed to process batch');
    }
  });
}
