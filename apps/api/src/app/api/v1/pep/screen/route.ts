import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

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

function calculateNameSimilarity(name1: string, name2: string): number {
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
      const screeningId = `pep_${Math.random().toString(36).slice(2, 10)}`;

      // Save screening result
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
      if (body.customerId && isPep) {
        const customerId = body.customerId.startsWith('cus_')
          ? body.customerId.slice(4)
          : body.customerId;

        await supabase
          .from('customers')
          .update({ is_pep: true })
          .eq('tenant_id', tenant.tenantId)
          .ilike('id', `${customerId}%`);
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
