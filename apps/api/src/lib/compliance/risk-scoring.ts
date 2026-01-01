import { RegionalConfig } from '../config/regions';

export interface RiskContext {
  transactionAmount: number;
  transactionCurrency: string;
  customerAgeDays: number;
  recentTransactionCount: number;
  hasUnusualPattern: boolean;
  customer: {
    isPep: boolean;
    isSanctioned: boolean;
    verificationStatus: string;
  };
  thresholds: RegionalConfig['thresholds'];
}

export interface RiskFactor {
  name: string;
  weight: number;
  condition: (ctx: RiskContext) => boolean;
  score: number;
  description: string;
}

export interface AppliedFactor {
  factor: string;
  score: number;
  reason: string;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: AppliedFactor[];
}

export const DEFAULT_RISK_FACTORS: RiskFactor[] = [
  {
    name: 'high_transaction_amount',
    weight: 1,
    condition: (ctx) => ctx.transactionAmount > ctx.thresholds.enhancedDdRequired,
    score: 30,
    description: 'Transaction exceeds enhanced DD threshold',
  },
  {
    name: 'medium_transaction_amount',
    weight: 1,
    condition: (ctx) =>
      ctx.transactionAmount > ctx.thresholds.ttrRequired &&
      ctx.transactionAmount <= ctx.thresholds.enhancedDdRequired,
    score: 20,
    description: 'Transaction exceeds TTR threshold',
  },
  {
    name: 'kyc_threshold_amount',
    weight: 1,
    condition: (ctx) =>
      ctx.transactionAmount > ctx.thresholds.kycRequired &&
      ctx.transactionAmount <= ctx.thresholds.ttrRequired,
    score: 10,
    description: 'Transaction exceeds KYC threshold',
  },
  {
    name: 'new_customer',
    weight: 1,
    condition: (ctx) => ctx.customerAgeDays < 7,
    score: 15,
    description: 'Customer account less than 7 days old',
  },
  {
    name: 'recent_customer',
    weight: 1,
    condition: (ctx) => ctx.customerAgeDays >= 7 && ctx.customerAgeDays < 30,
    score: 10,
    description: 'Customer account less than 30 days old',
  },
  {
    name: 'multiple_transactions',
    weight: 1,
    condition: (ctx) => ctx.recentTransactionCount >= 3,
    score: 20,
    description: 'Multiple transactions in short period',
  },
  {
    name: 'unusual_pattern',
    weight: 1,
    condition: (ctx) => ctx.hasUnusualPattern,
    score: 25,
    description: 'Unusual transaction pattern detected',
  },
  {
    name: 'pep_status',
    weight: 1,
    condition: (ctx) => ctx.customer.isPep,
    score: 30,
    description: 'Customer is a Politically Exposed Person',
  },
  {
    name: 'sanctioned_status',
    weight: 1,
    condition: (ctx) => ctx.customer.isSanctioned,
    score: 50,
    description: 'Customer has potential sanctions match',
  },
  {
    name: 'unverified_customer',
    weight: 1,
    condition: (ctx) => ctx.customer.verificationStatus === 'unverified',
    score: 10,
    description: 'Customer identity not verified',
  },
];

export function calculateRiskScore(
  context: RiskContext,
  customFactors: RiskFactor[] = []
): RiskResult {
  const allFactors = [...DEFAULT_RISK_FACTORS, ...customFactors];
  const appliedFactors: AppliedFactor[] = [];
  let totalScore = 0;

  for (const factor of allFactors) {
    if (factor.condition(context)) {
      const weightedScore = factor.score * factor.weight;
      totalScore += weightedScore;
      appliedFactors.push({
        factor: factor.name,
        score: weightedScore,
        reason: factor.description,
      });
    }
  }

  const finalScore = Math.min(totalScore, 100);

  return {
    riskScore: finalScore,
    riskLevel: getRiskLevel(finalScore),
    factors: appliedFactors,
  };
}

export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
