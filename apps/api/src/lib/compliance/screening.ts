import { SupabaseClient } from '@supabase/supabase-js';

export interface ScreeningInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  country?: string;
}

export interface ScreeningConfig {
  minimumMatchScore: number;
  sources: string[];
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
  isMatch: boolean;
  status: 'clear' | 'potential_match' | 'confirmed_match' | 'false_positive';
  matchScore: number;
  matches: ScreeningMatch[];
  sources: string[];
  screenedName: string;
  screenedAt: Date;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function sanctionsScreening(
  supabase: SupabaseClient,
  input: ScreeningInput,
  config: ScreeningConfig
): Promise<ScreeningResult> {
  const { firstName, lastName, dateOfBirth } = input;
  const { minimumMatchScore = 0.7, sources } = config;

  const fullName = `${firstName} ${lastName}`.trim();

  // Check exact matches
  const exactMatches = await checkExactMatch(supabase, fullName, sources);

  // Check fuzzy matches
  const fuzzyMatches = await checkFuzzyMatch(supabase, fullName, dateOfBirth, sources);

  const allMatches = [...exactMatches, ...fuzzyMatches];
  const uniqueMatches = deduplicateMatches(allMatches);
  const highConfidenceMatches = uniqueMatches.filter(m => m.matchScore >= minimumMatchScore);

  // Sort by match score descending
  highConfidenceMatches.sort((a, b) => b.matchScore - a.matchScore);

  const topScore = highConfidenceMatches.length > 0 ? highConfidenceMatches[0].matchScore : 0;
  const isMatch = highConfidenceMatches.length > 0;

  return {
    isMatch,
    status: isMatch ? 'potential_match' : 'clear',
    matchScore: topScore,
    matches: highConfidenceMatches,
    sources,
    screenedName: fullName,
    screenedAt: new Date(),
  };
}

async function checkExactMatch(
  supabase: SupabaseClient,
  fullName: string,
  sources: string[]
): Promise<ScreeningMatch[]> {
  const normalizedName = normalizeName(fullName);

  const { data, error } = await supabase
    .from('sanctioned_entities')
    .select('*')
    .in('source', sources)
    .or(`full_name.ilike.%${normalizedName}%,aliases.cs.{${normalizedName}}`);

  if (error) {
    console.error('Exact match error:', error);
    return [];
  }

  return (data || []).map((entity) => ({
    name: entity.full_name,
    matchScore: 1.0,
    source: entity.source,
    referenceNumber: entity.reference_number,
    dateOfBirth: entity.date_of_birth,
    nationality: entity.nationality,
  }));
}

async function checkFuzzyMatch(
  supabase: SupabaseClient,
  fullName: string,
  dateOfBirth: string | undefined,
  sources: string[]
): Promise<ScreeningMatch[]> {
  const normalizedName = normalizeName(fullName);
  const nameParts = normalizedName.split(' ');

  const { data, error } = await supabase
    .from('sanctioned_entities')
    .select('*')
    .in('source', sources)
    .textSearch('full_name', nameParts.join(' | '), {
      type: 'websearch',
      config: 'english',
    })
    .limit(50);

  if (error) {
    console.error('Fuzzy match error:', error);
    return [];
  }

  const matches: ScreeningMatch[] = [];

  for (const entity of data || []) {
    const score = calculateMatchScore(normalizedName, entity.full_name);

    // Boost score if DOB matches
    let finalScore = score;
    if (dateOfBirth && entity.date_of_birth) {
      if (dateOfBirth === entity.date_of_birth) {
        finalScore = Math.min(1.0, score + 0.3);
      }
    }

    // Check aliases too
    if (entity.aliases && Array.isArray(entity.aliases)) {
      for (const alias of entity.aliases) {
        const aliasScore = calculateMatchScore(normalizedName, alias);
        if (aliasScore > finalScore) {
          finalScore = aliasScore;
        }
      }
    }

    if (finalScore >= 0.6) {
      matches.push({
        name: entity.full_name,
        matchScore: Math.round(finalScore * 100) / 100,
        source: entity.source,
        referenceNumber: entity.reference_number,
        dateOfBirth: entity.date_of_birth,
        nationality: entity.nationality,
      });
    }
  }

  return matches;
}

function calculateMatchScore(str1: string, str2: string): number {
  const normalized1 = normalizeName(str1);
  const normalized2 = normalizeName(str2);

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - distance / maxLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function deduplicateMatches(matches: ScreeningMatch[]): ScreeningMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.referenceNumber}-${match.name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
