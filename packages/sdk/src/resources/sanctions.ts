import type { HttpClient } from '../utils/http';
import type { ScreeningInput, ScreeningResult } from '../types/sanctions';

export class SanctionsResource {
  constructor(private readonly http: HttpClient) {}

  async screen(input: ScreeningInput): Promise<ScreeningResult> {
    return this.http.post<ScreeningResult>('/sanctions/screen', input);
  }
}
