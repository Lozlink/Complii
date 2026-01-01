import type { HttpClient } from '../utils/http';
import type { ScreeningInput, ScreeningResult } from '../types/sanctions';

export interface BatchScreeningInput {
  screenings: (ScreeningInput & { id?: string })[];
}

export interface BatchScreeningResult {
  object: 'batch_screening_result';
  data: Array<ScreeningResult & { error?: string }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    matches: number;
  };
}

export class SanctionsResource {
  constructor(private readonly http: HttpClient) {}

  async screen(input: ScreeningInput): Promise<ScreeningResult> {
    return this.http.post<ScreeningResult>('/sanctions/screen', input);
  }

  async batchScreen(input: BatchScreeningInput): Promise<BatchScreeningResult> {
    return this.http.post<BatchScreeningResult>('/sanctions/batch-screen', input);
  }
}
