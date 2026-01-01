import type { HttpClient } from '../utils/http';
import type { RiskAssessmentInput, RiskAssessmentResult } from '../types/risk';

export class RiskResource {
  constructor(private readonly http: HttpClient) {}

  async assess(input: RiskAssessmentInput): Promise<RiskAssessmentResult> {
    return this.http.post<RiskAssessmentResult>('/risk/assess', input);
  }
}
