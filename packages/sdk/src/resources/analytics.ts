import type { HttpClient } from '../utils/http';

export interface AnalyticsOverviewParams {
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsOverview {
  object: 'analytics_overview';
  period: {
    start: string;
    end: string;
  };
  customers: {
    total: number;
    verified: number;
    sanctioned: number;
    pep: number;
    verificationRate: number;
  };
  transactions: {
    total: number;
    totalAmount: number;
    averageAmount: number;
    ttrRequired: number;
    flaggedForReview: number;
  };
  screenings: {
    total: number;
    matches: number;
    matchRate: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export class AnalyticsResource {
  constructor(private readonly http: HttpClient) {}

  async getOverview(params?: AnalyticsOverviewParams): Promise<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>('/analytics/overview', params);
  }
}
