import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import type { AuthenticatedRequest } from '@/lib/auth/types';

export const runtime = 'nodejs';

/**
 * UPSERT Customer - Create or update by external ID
 * Allows clients to sync their existing customer data without duplication
 */
export async function POST(request: NextRequest) {
  try {
    const req = request as AuthenticatedRequest;
    const { tenant } = req;
    const supabase = getServiceClient();

    const body = await request.json();
    const {
      externalId, // Required for UPSERT
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      residentialAddress,
      metadata,
    } = body;

    if (!externalId) {
      return NextResponse.json(
        { error: 'externalId is required for upsert operations' },
        { status: 400 }
      );
    }

    // Check if customer exists with this external ID
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('external_id', externalId)
      .single();

    if (existingCustomer) {
      // UPDATE existing customer
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          date_of_birth: dateOfBirth,
          residential_address: residentialAddress,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.id,
        action_type: 'customer.updated',
        entity_type: 'customer',
        entity_id: updatedCustomer.id,
        description: `Customer updated via UPSERT (externalId: ${externalId})`,
        metadata: { externalId, updatedFields: Object.keys(body) },
      });

      return NextResponse.json({
        id: updatedCustomer.id,
        object: 'customer',
        externalId: updatedCustomer.external_id,
        firstName: updatedCustomer.first_name,
        lastName: updatedCustomer.last_name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        dateOfBirth: updatedCustomer.date_of_birth,
        residentialAddress: updatedCustomer.residential_address,
        kycStatus: updatedCustomer.kyc_status,
        riskLevel: updatedCustomer.risk_level,
        metadata: updatedCustomer.metadata,
        createdAt: updatedCustomer.created_at,
        updatedAt: updatedCustomer.updated_at,
        upserted: 'updated',
      });
    } else {
      // CREATE new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenant.id,
          external_id: externalId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          date_of_birth: dateOfBirth,
          residential_address: residentialAddress,
          kyc_status: 'pending',
          risk_level: 'low',
          metadata,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.id,
        action_type: 'customer.created',
        entity_type: 'customer',
        entity_id: newCustomer.id,
        description: `Customer created via UPSERT (externalId: ${externalId})`,
        metadata: { externalId },
      });

      return NextResponse.json(
        {
          id: newCustomer.id,
          object: 'customer',
          externalId: newCustomer.external_id,
          firstName: newCustomer.first_name,
          lastName: newCustomer.last_name,
          email: newCustomer.email,
          phone: newCustomer.phone,
          dateOfBirth: newCustomer.date_of_birth,
          residentialAddress: newCustomer.residential_address,
          kycStatus: newCustomer.kyc_status,
          riskLevel: newCustomer.risk_level,
          metadata: newCustomer.metadata,
          createdAt: newCustomer.created_at,
          updatedAt: newCustomer.updated_at,
          upserted: 'created',
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Customer upsert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
