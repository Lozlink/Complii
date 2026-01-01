import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import { sanctionsScreening } from '@/lib/compliance/screening';

// POST /v1/sanctions/batch-screen - Batch screen multiple names
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const body = await request.json();
      const supabase = getServiceClient();
      const config = getTenantConfig(tenant.region, tenant.settings);

      if (!Array.isArray(body.screenings) || body.screenings.length === 0) {
        return NextResponse.json(
          { error: 'screenings array is required and must not be empty' },
          { status: 400 }
        );
      }

      if (body.screenings.length > 100) {
        return NextResponse.json(
          { error: 'Maximum 100 screenings per batch' },
          { status: 400 }
        );
      }

      const results = [];

      for (const screening of body.screenings) {
        try {
          if (!screening.firstName || !screening.lastName) {
            results.push({
              id: screening.id || null,
              error: 'firstName and lastName are required',
              status: 'failed',
            });
            continue;
          }

          const settings = tenant.settings as Record<string, unknown> | undefined;
          const screeningSettings = settings?.screening as
            | { minimumMatchScore?: number }
            | undefined;
          const screeningConfig = {
            minimumMatchScore: screeningSettings?.minimumMatchScore || 0.7,
            sources: config.screeningSources,
          };

          const result = await sanctionsScreening(
            supabase,
            {
              firstName: screening.firstName,
              lastName: screening.lastName,
              dateOfBirth: screening.dateOfBirth,
              country: screening.country,
            },
            screeningConfig
          );

          // Save screening record
          const { data: saved } = await supabase
            .from('sanctions_screenings')
            .insert({
              tenant_id: tenant.tenantId,
              customer_id: screening.customerId || null,
              screened_first_name: screening.firstName,
              screened_last_name: screening.lastName,
              screened_dob: screening.dateOfBirth || null,
              screened_country: screening.country || null,
              is_match: result.isMatch,
              match_score: result.matchScore,
              matched_entities: result.matches,
              status: result.status,
              screening_sources: result.sources,
              screened_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          results.push({
            id: saved?.id || null,
            object: 'screening',
            firstName: screening.firstName,
            lastName: screening.lastName,
            isMatch: result.isMatch,
            matchScore: result.matchScore,
            status: result.status,
            matches: result.matches,
          });
        } catch (error) {
          results.push({
            id: screening.id || null,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed',
          });
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'batch_screening_completed',
        entity_type: 'sanctions_screening',
        description: `Batch screened ${results.length} names`,
        metadata: {
          total: body.screenings.length,
          matches: results.filter((r) => r.isMatch).length,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'batch_screening_result',
        data: results,
        summary: {
          total: body.screenings.length,
          succeeded: results.filter((r) => !r.error).length,
          failed: results.filter((r) => r.error).length,
          matches: results.filter((r) => r.isMatch).length,
        },
      });
    } catch (error) {
      console.error('Batch screening error:', error);
      return NextResponse.json(
        { error: 'Failed to perform batch screening' },
        { status: 500 }
      );
    }
  });
}
