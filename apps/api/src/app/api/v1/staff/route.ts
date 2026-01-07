import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('STAFF_API');

// Helper function to calculate training status
function calculateTrainingStatus(staff: any, trainingRecords: any[]): {
  status: 'compliant' | 'overdue' | 'no_training' | 'not_applicable';
  label: string;
  color: string;
} {
  // If staff doesn't require AML training
  if (!staff.requires_aml_training) {
    return { status: 'not_applicable', label: 'Not Applicable', color: 'gray' };
  }

  // Filter to completed training records
  const completedTraining = trainingRecords.filter(
    t => t.completion_status === 'completed'
  );

  // No completed training
  if (completedTraining.length === 0) {
    return { status: 'no_training', label: 'No Training', color: 'red' };
  }

  // Find most recent training with a due date
  const trainingsWithDueDate = completedTraining.filter(t => t.next_training_due);

  if (trainingsWithDueDate.length === 0) {
    // Has training but no due date set
    return { status: 'compliant', label: 'Compliant', color: 'green' };
  }

  // Sort by next_training_due to get the earliest due date
  trainingsWithDueDate.sort((a, b) =>
    new Date(a.next_training_due).getTime() - new Date(b.next_training_due).getTime()
  );

  const nextDueDate = new Date(trainingsWithDueDate[0].next_training_due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if overdue
  if (nextDueDate < today) {
    return { status: 'overdue', label: 'Overdue', color: 'red' };
  }

  // Compliant
  return { status: 'compliant', label: 'Compliant', color: 'green' };
}

// GET /api/v1/staff - List all staff for tenant
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);
      const activeOnly = searchParams.get('active') === 'true';

      let query = supabase
        .from('staff')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .order('full_name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data: staff, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Fetch training records for all staff in this tenant
      const { data: allTraining } = await supabase
        .from('staff_training')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .order('training_date', { ascending: false });

      // Calculate training status for each staff member
      const staffWithStatus = staff?.map(member => {
        const memberTraining = allTraining?.filter(t => t.staff_id === member.id) || [];
        const trainingStatus = calculateTrainingStatus(member, memberTraining);
        return {
          ...member,
          training_status: trainingStatus,
        };
      });

      return NextResponse.json({
        object: 'list',
        data: staffWithStatus || [],
      });
    } catch (error) {
      logger.error('[STAFF_GET]', error);
      return NextResponse.json(
        { error: 'Failed to fetch staff' },
        { status: 500 }
      );
    }
  });
}
// POST /api/v1/staff - Create new staff member
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const body = await req.json();
      
      const {
        user_id,
        full_name,
        email,
        position,
        department,
        employment_start_date,
        requires_aml_training = true,
      } = body;

      // Validation
      if (!full_name || !email) {
        return NextResponse.json(
          { error: 'Full name and email are required' },
          { status: 400 }
        );
      }

      // Check for duplicate email within this tenant
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'Staff member with this email already exists' },
          { status: 409 }
        );
      }

      const { data: newStaff, error } = await supabase
        .from('staff')
        .insert({
          tenant_id: tenant.tenantId,
          user_id,
          full_name,
          email,
          position,
          department,
          employment_start_date: employment_start_date || new Date().toISOString().split('T')[0],
          requires_aml_training,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        object: 'staff_member',
        ...newStaff 
      }, { status: 201 });
    } catch (error) {
      logger.error('[STAFF_POST]', error);
      return NextResponse.json(
        { error: 'Failed to create staff member' },
        { status: 500 }
      );
    }
  });
}
