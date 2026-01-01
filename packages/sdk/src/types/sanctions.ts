export interface ScreeningInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  country?: string;
  customerId?: string;
}

export interface ScreeningMatch {
  name: string;
  matchScore: number;
  source: string;
  referenceNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
}

export interface ScreeningResult {
  id: string;
  object: 'screening';
  isMatch: boolean;
  status: 'clear' | 'potential_match' | 'confirmed_match' | 'false_positive';
  matchScore: number;
  matches: ScreeningMatch[];
  screenedAt: string;
  sources: string[];
  input: ScreeningInput;
}
