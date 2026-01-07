import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('TRAINING_API');

// GET /api/v1/training - List training records for tenant
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);
      
      const staffId = searchParams.get('staffId');
      const dueSoon = searchParams.get('dueSoon') === 'true'; // Training due in next 30 days

      let query = supabase
        .from('staff_training')
        .select(`
          *,
          staff:staff_id (
            id,
            full_name,
            email,
            position,
            is_active
          )
        `)
        .eq('tenant_id', tenant.tenantId)
        .order('training_date', { ascending: false });

      if (staffId) {
        query = query.eq('staff_id', staffId);
      }

      if (dueSoon) {
        const today = new Date();
        const in30Days = new Date();
        in30Days.setDate(today.getDate() + 30);

        query = query
          .gte('next_training_due', today.toISOString().split('T')[0])
          .lte('next_training_due', in30Days.toISOString().split('T')[0]);
      }

      const { data: training, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        object: 'list',
        data: training || [],
      });
    } catch (error) {
      logger.error('[TRAINING_GET]', error);
      return NextResponse.json(
        { error: 'Failed to fetch training records' },
        { status: 500 }
      );
    }
  });
}

// POST /api/v1/training - Create training record
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const body = await req.json();
      
      const {
        staffId,
        trainingType,
        trainingDate,
        trainingProvider,
        topicsCovered,
        durationHours,
        completionStatus = 'completed',
        passScore,
        certificateUrl,
        conductedBy,
        notes,
      } = body;

      // Validation
      if (!staffId || !trainingType || !trainingDate) {
        return NextResponse.json(
          { error: 'staffId, trainingType, and trainingDate are required' },
          { status: 400 }
        );
      }

      // Verify staff belongs to this tenant
      const { data: staffMember } = await supabase
        .from('staff')
        .select('id')
        .eq('id', staffId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (!staffMember) {
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }

      // Auto-calculate next training due date (1 year for annual refreshers)
      let nextTrainingDue = null;
      if (trainingType === 'initial_aml' || trainingType === 'annual_refresher') {
        const trainingDateObj = new Date(trainingDate);
        const nextDue = new Date(trainingDateObj);
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        nextTrainingDue = nextDue.toISOString().split('T')[0];
      }

      const { data: newTraining, error } = await supabase
        .from('staff_training')
        .insert({
          tenant_id: tenant.tenantId,
          staff_id: staffId,
          training_type: trainingType,
          training_date: trainingDate,
          training_provider: trainingProvider,
          topics_covered: topicsCovered,
          duration_hours: durationHours,
          completion_status: completionStatus,
          pass_score: passScore,
          certificate_url: certificateUrl,
          conducted_by: conductedBy,
          next_training_due: nextTrainingDue,
          notes,
        })
        .select(`
          *,
          staff:staff_id (
            id,
            full_name,
            email,
            position
          )
        `)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Update staff member's last training date
      await supabase
        .from('staff')
        .update({
          last_training_date: trainingDate,
          next_training_due: nextTrainingDue,
        })
        .eq('id', staffId)
        .eq('tenant_id', tenant.tenantId);

      return NextResponse.json({ 
        object: 'training_record',
        ...newTraining 
      }, { status: 201 });
    } catch (error) {
      logger.error('[TRAINING_POST]', error);
      return NextResponse.json(
        { error: 'Failed to create training record' },
        { status: 500 }
      );
    }
  });
}
