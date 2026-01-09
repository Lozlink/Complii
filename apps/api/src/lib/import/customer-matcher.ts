import { SupabaseClient } from '@supabase/supabase-js';
import { TransactionRow } from './csv-parser';

export interface CustomerMatchResult {
  matched: boolean;
  customerId?: string;
  matchMethod?: 'customer_id' | 'external_id' | 'email' | 'name_dob' | 'created';
  customerData?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  error?: string;
}

/**
 * Find or create customer for a transaction row
 */
export async function findOrCreateCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  row: TransactionRow
): Promise<CustomerMatchResult> {
  // Strategy 1: Match by Complii customer ID
  if (row.customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('id', row.customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (customer) {
      return {
        matched: true,
        customerId: customer.id,
        matchMethod: 'customer_id',
        customerData: {
          id: customer.id,
          firstName: customer.first_name,
          lastName: customer.last_name,
          email: customer.email,
        },
      };
    }
  }

  // Strategy 2: Match by external customer ID
  if (row.externalCustomerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('external_id', row.externalCustomerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (customer) {
      return {
        matched: true,
        customerId: customer.id,
        matchMethod: 'external_id',
        customerData: {
          id: customer.id,
          firstName: customer.first_name,
          lastName: customer.last_name,
          email: customer.email,
        },
      };
    }
  }

  // Strategy 3: Match by email
  if (row.customerEmail) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('email', row.customerEmail.toLowerCase())
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (customer) {
      return {
        matched: true,
        customerId: customer.id,
        matchMethod: 'email',
        customerData: {
          id: customer.id,
          firstName: customer.first_name,
          lastName: customer.last_name,
          email: customer.email,
        },
      };
    }
  }

  // Strategy 4: Match by name + DOB (exact match)
  if (row.customerFirstName && row.customerLastName && row.customerDateOfBirth) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('first_name', row.customerFirstName)
      .eq('last_name', row.customerLastName)
      .eq('date_of_birth', row.customerDateOfBirth)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (customer) {
      return {
        matched: true,
        customerId: customer.id,
        matchMethod: 'name_dob',
        customerData: {
          id: customer.id,
          firstName: customer.first_name,
          lastName: customer.last_name,
          email: customer.email,
        },
      };
    }
  }

  // No match found - create new customer
  if (row.customerFirstName && row.customerLastName) {
    try {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          external_id: row.externalCustomerId || null,
          first_name: row.customerFirstName,
          last_name: row.customerLastName,
          email: row.customerEmail?.toLowerCase() || null,
          date_of_birth: row.customerDateOfBirth || null,
          phone: row.customerPhone || null,
          address: row.customerAddress || null,
          city: row.customerCity || null,
          state: row.customerState || null,
          postcode: row.customerPostcode || null,
          country: row.customerCountry || 'AU',
          customer_type: 'individual',
          verification_status: 'unverified',
          risk_level: 'low',
          risk_score: 0,
          is_pep: false,
          is_sanctioned: false,
          requires_edd: false,
          metadata: {
            created_via: 'csv_import',
            import_date: new Date().toISOString(),
          },
        })
        .select('id, first_name, last_name, email')
        .single();

      if (error) {
        return {
          matched: false,
          error: `Failed to create customer: ${error.message}`,
        };
      }

      return {
        matched: true,
        customerId: newCustomer.id,
        matchMethod: 'created',
        customerData: {
          id: newCustomer.id,
          firstName: newCustomer.first_name,
          lastName: newCustomer.last_name,
          email: newCustomer.email,
        },
      };
    } catch (err) {
      return {
        matched: false,
        error: `Failed to create customer: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  return {
    matched: false,
    error: 'Insufficient customer information to create new customer (need at least firstName + lastName)',
  };
}

/**
 * Batch find or create customers for multiple rows
 */
export async function batchFindOrCreateCustomers(
  supabase: SupabaseClient,
  tenantId: string,
  rows: TransactionRow[]
): Promise<Map<number, CustomerMatchResult>> {
  const results = new Map<number, CustomerMatchResult>();

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((row, index) =>
      findOrCreateCustomer(supabase, tenantId, row).then((result) => ({
        index: i + index,
        result,
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    for (const { index, result } of batchResults) {
      results.set(index, result);
    }
  }

  return results;
}
