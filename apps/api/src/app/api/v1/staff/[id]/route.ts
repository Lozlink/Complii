import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('STAFF_DETAIL_API');

// GET /api/v1/staff/[id] - Get single staff member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      const { data: staff, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (error || !staff) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }

      // Get training records for this staff member
      const { data: training } = await supabase
        .from('staff_training')
        .select('*')
        .eq('staff_id', id)
        .eq('tenant_id', tenant.tenantId)
        .order('training_date', { ascending: false });

      return NextResponse.json({ 
        object: 'staff_member',
        ...staff,
        trainingRecords: training || [] 
      });
    } catch (error) {
      logger.error('[STAFF_GET_ID]', error);
      return NextResponse.json(
        { error: 'Failed to fetch staff member' },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/v1/staff/[id] - Update staff member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;
      const body = await req.json();
      
      const {
        fullName,
        email,
        position,
        department,
        employmentStartDate,
        employmentEndDate,
        isActive,
        requiresAmlTraining,
        userId,
      } = body;

      const updateData: Record<string, unknown> = {};
      if (fullName !== undefined) updateData.full_name = fullName;
      if (email !== undefined) updateData.email = email;
      if (position !== undefined) updateData.position = position;
      if (department !== undefined) updateData.department = department;
      if (employmentStartDate !== undefined) updateData.employment_start_date = employmentStartDate;
      if (employmentEndDate !== undefined) updateData.employment_end_date = employmentEndDate;
      if (isActive !== undefined) updateData.is_active = isActive;
      if (requiresAmlTraining !== undefined) updateData.requires_aml_training = requiresAmlTraining;
      if (userId !== undefined) updateData.user_id = userId;

      const { data: updatedStaff, error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!updatedStaff) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        object: 'staff_member',
        ...updatedStaff 
      });
    } catch (error) {
      logger.error('[STAFF_PATCH]', error);
      return NextResponse.json(
        { error: 'Failed to update staff member' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/v1/staff/[id] - Soft delete (mark as inactive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      // Soft delete - mark as inactive and set end date
      const { data, error } = await supabase
        .from('staff')
        .update({
          is_active: false,
          employment_end_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        deleted: true,
        id 
      });
    } catch (error) {
      logger.error('[STAFF_DELETE]', error);
      return NextResponse.json(
        { error: 'Failed to deactivate staff member' },
        { status: 500 }
      );
    }
  });
}
