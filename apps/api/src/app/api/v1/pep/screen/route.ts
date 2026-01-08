import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { dispatchAlertCreated } from '@/lib/webhooks/dispatcher';

// Simulated PEP database - in production, integrate with actual PEP databases
const PEP_DATABASE = [
  {
    name: 'Vladimir Putin',
    position: 'President of Russia',
    country: 'RU',
    category: 'head_of_state',
    riskLevel: 'high',
  },
  {
    name: 'Xi Jinping',
    position: 'President of China',
    country: 'CN',
    category: 'head_of_state',
    riskLevel: 'high',
  },
  // Add more PEP entries as needed
];

export function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return 1.0;

  // Simple word matching for demo
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);

  let matches = 0;
  words1.forEach((w1) => {
    if (words2.some((w2) => w2 === w1 || w1.includes(w2) || w2.includes(w1))) {
      matches++;
    }
  });

  return matches / Math.max(words1.length, words2.length);
}

// POST /v1/pep/screen - Screen for PEP status
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const body = await request.json();
      const supabase = getServiceClient();

      if (!body.firstName && !body.lastName && !body.fullName) {
        return NextResponse.json(
          { error: 'firstName and lastName, or fullName is required' },
          { status: 400 }
        );
      }

      const fullName =
        body.fullName ||
        `${body.firstName || ''} ${body.lastName || ''}`.trim();

      // Screen against PEP database
      const matches = PEP_DATABASE.map((pep) => {
        const score = calculateNameSimilarity(fullName, pep.name);
        return {
          ...pep,
          matchScore: score,
        };
      })
        .filter((m) => m.matchScore >= 0.7)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      const isPep = matches.length > 0 && matches[0].matchScore >= 0.85;
      const topMatch = matches[0];

      // Parse customer ID if provided
      let parsedCustomerId: string | null = null;
      if (body.customerId) {
        parsedCustomerId = body.customerId.startsWith('cus_')
          ? body.customerId.slice(4)
          : body.customerId;
      }

      // Save to pep_screenings table
      const { data: screening, error: insertError } = await supabase
        .from('pep_screenings')
        .insert({
          tenant_id: tenant.tenantId,
          customer_id: parsedCustomerId,
          screened_full_name: fullName,
          screened_country: body.country || null,
          screened_dob: body.dateOfBirth || null,
          is_pep: isPep,
          match_score: topMatch?.matchScore || 0,
          matched_details: isPep && topMatch ? {
            name: topMatch.name,
            position: topMatch.position,
            country: topMatch.country,
            category: topMatch.category,
            riskLevel: topMatch.riskLevel,
          } : {},
          status: isPep ? 'potential_match' : 'clear',
          screened_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to save PEP screening:', insertError);
      }

      const screeningId = screening?.id
        ? `pep_${screening.id.slice(0, 8)}`
        : `pep_${Math.random().toString(36).slice(2, 10)}`;

      // Log audit event
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'pep_screening_completed',
        entity_type: 'pep_screening',
        entity_id: screeningId,
        description: `PEP screening for ${fullName}`,
        metadata: {
          fullName,
          isPep,
          matchCount: matches.length,
          customerId: body.customerId,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      // If customer ID provided, update customer record
      if (parsedCustomerId && isPep) {
        await supabase
          .from('customers')
          .update({ is_pep: true })
          .eq('tenant_id', tenant.tenantId)
          .ilike('id', `${parsedCustomerId}%`);

        // Create alert for PEP detection
        try {
          const { data: rule } = await supabase
            .from('alert_rules')
            .select('*')
            .eq('tenant_id', tenant.tenantId)
            .eq('rule_code', 'PEP_DETECTION')
            .eq('is_enabled', true)
            .maybeSingle();

          if (rule) {
            // Generate alert number
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const { count } = await supabase
              .from('alerts')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenant.tenantId)
              .gte('created_at', new Date().toISOString().slice(0, 10));

            const alertNumber = `ALT-${today}-${String((count || 0) + 1).padStart(4, '0')}`;

            // Create alert
            const { data: alert } = await supabase
              .from('alerts')
              .insert({
                tenant_id: tenant.tenantId,
                alert_rule_id: rule.id,
                alert_number: alertNumber,
                title: `PEP detected: ${fullName}`,
                description: `Customer identified as Politically Exposed Person: ${topMatch.name} (${topMatch.position}, ${topMatch.country}). Match confidence: ${(topMatch.matchScore * 100).toFixed(0)}%. Enhanced due diligence required.`,
                severity: rule.severity || 'high',
                status: 'open',
                entity_type: 'customer',
                entity_id: parsedCustomerId,
                customer_id: parsedCustomerId,
                metadata: {
                  screeningId,
                  matchedName: topMatch.name,
                  matchedPosition: topMatch.position,
                  matchedCountry: topMatch.country,
                  matchScore: topMatch.matchScore,
                  category: topMatch.category,
                  riskLevel: topMatch.riskLevel,
                },
              })
              .select()
              .single();

            // Dispatch webhook
            if (alert) {
              await dispatchAlertCreated(supabase, tenant.tenantId, alert).catch((err) => {
                console.error('Failed to dispatch PEP alert webhook:', err);
              });
            }

            // Auto-create case if rule configured
            if (rule.auto_create_case && alert) {
              const caseNumber = `CASE-${today}-${String((count || 0) + 1).padStart(4, '0')}`;
              await supabase.from('cases').insert({
                tenant_id: tenant.tenantId,
                case_number: caseNumber,
                case_type: rule.case_type || 'pep_review',
                priority: rule.case_priority || 'high',
                status: 'open',
                title: `PEP Review: ${fullName}`,
                description: alert.description,
                customer_id: parsedCustomerId,
                assigned_to: null,
                metadata: {
                  alertId: alert.id,
                  screeningId,
                },
              });

              await supabase
                .from('alerts')
                .update({ status: 'escalated' })
                .eq('id', alert.id);
            }
          }
        } catch (alertError) {
          console.error('Failed to create alert for PEP detection:', alertError);
          // Don't fail the screening if alert fails
        }
      }

      return NextResponse.json({
        id: screeningId,
        object: 'pep_screening',
        fullName,
        isPep,
        status: isPep ? 'match_found' : 'clear',
        matches: matches.map((m) => ({
          name: m.name,
          position: m.position,
          country: m.country,
          category: m.category,
          riskLevel: m.riskLevel,
          matchScore: m.matchScore,
        })),
        screenedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('PEP screening error:', error);
      return NextResponse.json(
        { error: 'Failed to perform PEP screening' },
        { status: 500 }
      );
    }
  });
}
