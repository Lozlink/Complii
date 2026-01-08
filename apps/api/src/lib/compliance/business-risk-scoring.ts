import { EntityType, BeneficialOwner } from '@/types/business';

interface BusinessRiskFactors {
  entityType: EntityType;
  yearsInOperation?: number;
  industryCode?: string;
  abnStatus: string;
  gstRegistered: boolean;
  uboCount: number;
  ubos: Array<{
    isPep: boolean;
    isSanctioned: boolean;
    verificationStatus: string;
  }>;
  isInterstate: boolean;
  transactionAmount: number;
  hasMultipleRecentTransactions: boolean;
  unusualPattern: boolean;
}

// High-risk ANZSIC industry codes
const HIGH_RISK_INDUSTRIES = [
  '6419', // Other Depository Financial Intermediation
  '6420', // Other Non-Depository Financing
  '6910', // Auxiliary Finance and Investment Services
  '6921', // Foreign Exchange Dealing Services
  '7320', // Gambling and Betting Services
  '9241', // Religious Services
  '9540', // Pubs, Taverns and Bars
];

export function calculateBusinessRiskScore(factors: BusinessRiskFactors): number {
  let score = 0;

  // Entity type risk
  if (factors.entityType === 'trust' || factors.entityType === 'smsf') {
    score += 15;
  } else if (factors.entityType === 'partnership' && factors.uboCount >= 3) {
    score += 10;
  }

  // Business age
  if (factors.yearsInOperation !== undefined) {
    if (factors.yearsInOperation < 1) score += 20;
    else if (factors.yearsInOperation < 2) score += 15;
    else if (factors.yearsInOperation < 5) score += 5;
  }

  // Industry risk
  if (factors.industryCode && HIGH_RISK_INDUSTRIES.includes(factors.industryCode)) {
    score += 20;
  }

  // ABN status
  if (factors.abnStatus !== 'Active') {
    score += 25;
  }

  // GST registration (lack of suggests smaller/newer business)
  if (!factors.gstRegistered) {
    score += 5;
  }

  // UBO-related risk
  if (factors.uboCount >= 4) {
    score += 15;
  } else if (factors.uboCount >= 2) {
    score += 10;
  }

  // PEP among UBOs
  const hasPep = factors.ubos.some(ubo => ubo.isPep);
  if (hasPep) {
    score += 30;
  }

  // Sanctions match - this should block, but add score for tracking
  const hasSanctioned = factors.ubos.some(ubo => ubo.isSanctioned);
  if (hasSanctioned) {
    score += 50; // Will likely trigger block
  }

  // Unverified UBOs
  const hasUnverifiedUbo = factors.ubos.some(
    ubo => ubo.verificationStatus !== 'verified'
  );
  if (hasUnverifiedUbo) {
    score += 15;
  }

  // Interstate operations
  if (factors.isInterstate) {
    score += 5;
  }

  // Transaction amount
  if (factors.transactionAmount > 100000) score += 30;
  else if (factors.transactionAmount > 50000) score += 20;
  else if (factors.transactionAmount > 20000) score += 10;

  // Multiple recent transactions
  if (factors.hasMultipleRecentTransactions) {
    score += 20;
  }

  // Unusual patterns
  if (factors.unusualPattern) {
    score += 25;
  }

  return Math.min(score, 100);
}

export function getBusinessRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function shouldBlockBusiness(factors: BusinessRiskFactors): {
  blocked: boolean;
  reason?: string;
} {
  // Check for sanctions match
  const sanctionedUbo = factors.ubos.find(ubo => ubo.isSanctioned);
  if (sanctionedUbo) {
    return { blocked: true, reason: 'Beneficial owner matches sanctions list' };
  }

  // Check for inactive ABN
  if (factors.abnStatus === 'Cancelled' || factors.abnStatus === 'Deleted') {
    return { blocked: true, reason: 'Business ABN is no longer active' };
  }

  return { blocked: false };
}