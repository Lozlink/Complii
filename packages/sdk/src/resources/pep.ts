import type { HttpClient } from '../utils/http';

export interface PepScreeningInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  customerId?: string;
}

export interface PepScreeningResult {
  id: string;
  object: 'pep_screening';
  fullName: string;
  isPep: boolean;
  status: 'match_found' | 'clear';
  matches: Array<{
    name: string;
    position: string;
    country: string;
    category: string;
    riskLevel: string;
    matchScore: number;
  }>;
  screenedAt: string;
}

export class PepResource {
  constructor(private readonly http: HttpClient) {}

  async screen(input: PepScreeningInput): Promise<PepScreeningResult> {
    return this.http.post<PepScreeningResult>('/pep/screen', input);
  }
}
