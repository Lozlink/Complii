import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('TRAINING_DETAIL_API');

// PATCH /api/v1/training/[id] - Update training record
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
        trainingType,
        trainingDate,
        trainingProvider,
        topicsCovered,
        durationHours,
        completionStatus,
        passScore,
        certificateUrl,
        conductedBy,
        nextTrainingDue,
        notes,
      } = body;

      const updateData: Record<string, unknown> = {};
      if (trainingType !== undefined) updateData.training_type = trainingType;
      if (trainingDate !== undefined) updateData.training_date = trainingDate;
      if (trainingProvider !== undefined) updateData.training_provider = trainingProvider;
      if (topicsCovered !== undefined) updateData.topics_covered = topicsCovered;
      if (durationHours !== undefined) updateData.duration_hours = durationHours;
      if (completionStatus !== undefined) updateData.completion_status = completionStatus;
      if (passScore !== undefined) updateData.pass_score = passScore;
      if (certificateUrl !== undefined) updateData.certificate_url = certificateUrl;
      if (conductedBy !== undefined) updateData.conducted_by = conductedBy;
      if (nextTrainingDue !== undefined) updateData.next_training_due = nextTrainingDue;
      if (notes !== undefined) updateData.notes = notes;

      const { data: updatedTraining, error } = await supabase
        .from('staff_training')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!updatedTraining) {
        return NextResponse.json({ error: 'Training record not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        object: 'training_record',
        ...updatedTraining 
      });
    } catch (error) {
      logger.error('[TRAINING_PATCH]', error);
      return NextResponse.json(
        { error: 'Failed to update training record' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/v1/training/[id] - Delete training record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      const { error } = await supabase
        .from('staff_training')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        deleted: true,
        id 
      });
    } catch (error) {
      logger.error('[TRAINING_DELETE]', error);
      return NextResponse.json(
        { error: 'Failed to delete training record' },
        { status: 500 }
      );
    }
  });
}
