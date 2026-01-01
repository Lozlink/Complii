export interface RiskFactor {
  factor: string;
  score: number;
  reason: string;
}

export interface RiskFlags {
  structuring: boolean;
  requiresKyc: boolean;
  requiresTtr: boolean;
  requiresEnhancedDd: boolean;
}

export interface RiskThresholds {
  kycRequired: number;
  ttrRequired: number;
  enhancedDdRequired: number;
}

export interface RiskAssessmentInput {
  customerId: string;
  transactionAmount?: number;
  transactionCurrency?: string;
  includeStructuringCheck?: boolean;
}

export interface RiskAssessmentResult {
  object: 'risk_assessment';
  customerId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  flags: RiskFlags;
  thresholds: RiskThresholds;
  assessedAt: string;
}
