import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import { sanctionsScreening } from '@/lib/compliance/screening';
import { createValidationError, createInternalError } from '@/lib/utils/errors';
import { dispatchScreeningMatch } from '@/lib/webhooks/dispatcher';

interface ScreenRequestBody {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  country?: string;
  customerId?: string;
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body: ScreenRequestBody = await req.json();

      // Validate required fields
      if (!body.firstName) {
        return createValidationError('firstName', 'firstName is required');
      }
      if (!body.lastName) {
        return createValidationError('lastName', 'lastName is required');
      }

      const { tenant } = req;
      const config = getTenantConfig(tenant.region, tenant.settings);
      const supabase = getServiceClient();

      // Get screening configuration
      const settings = tenant.settings as Record<string, unknown> | undefined;
      const screeningSettings = settings?.screening as { minimumMatchScore?: number } | undefined;
      const screeningConfig = {
        minimumMatchScore: screeningSettings?.minimumMatchScore || 0.7,
        sources: config.screeningSources,
      };

      // Perform screening
      const result = await sanctionsScreening(
        supabase,
        {
          firstName: body.firstName,
          lastName: body.lastName,
          dateOfBirth: body.dateOfBirth,
          country: body.country,
        },
        screeningConfig
      );

      // Save screening record
      const { data: screening, error: insertError } = await supabase
        .from('sanctions_screenings')
        .insert({
          tenant_id: tenant.tenantId,
          customer_id: body.customerId || null,
          screened_first_name: body.firstName,
          screened_last_name: body.lastName,
          screened_dob: body.dateOfBirth || null,
          screened_country: body.country || null,
          is_match: result.isMatch,
          match_score: result.matchScore,
          matched_entities: result.matches,
          status: result.status,
          screening_sources: result.sources,
          screened_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to save screening:', insertError);
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'screening_performed',
        entity_type: 'screening',
        entity_id: screening?.id,
        description: `Screened ${body.firstName} ${body.lastName}`,
        metadata: {
          isMatch: result.isMatch,
          matchCount: result.matches.length,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      const response = {
        id: screening?.id ? `scr_${screening.id.slice(0, 8)}` : undefined,
        object: 'screening',
        isMatch: result.isMatch,
        status: result.status,
        matchScore: result.matchScore,
        matches: result.matches,
        screenedAt: result.screenedAt.toISOString(),
        sources: result.sources,
        input: {
          firstName: body.firstName,
          lastName: body.lastName,
          dateOfBirth: body.dateOfBirth,
          country: body.country,
        },
      };

      // Dispatch webhook if match found
      if (result.isMatch) {
        dispatchScreeningMatch(supabase, tenant.tenantId, response);
      }

      return NextResponse.json(response);
    } catch (error) {
      console.error('Screening error:', error);
      return createInternalError('Failed to perform screening');
    }
  });
}
