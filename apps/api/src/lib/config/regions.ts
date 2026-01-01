export interface RegionalConfig {
  thresholds: {
    ttrRequired: number;
    kycRequired: number;
    enhancedDdRequired: number;
    structuringWindow: number;
    structuringMinTxCount: number;
    structuringAmountRange: {
      min: number;
      max: number;
    };
  };
  deadlines: {
    ttrSubmission: number;
    smrSubmission: number;
  };
  screeningSources: string[];
  holidays: string[];
  workweek: number[];
  currency: string;
  currencySymbol: string;
  regulator: string;
  regulatorReportingFormat?: string;
}

export const REGIONAL_CONFIGS: Record<string, RegionalConfig> = {
  // Australia (AUSTRAC)
  AU: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 5000,
      enhancedDdRequired: 50000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 4000, max: 5000 },
    },
    deadlines: {
      ttrSubmission: 10,
      smrSubmission: 3,
    },
    screeningSources: ['DFAT', 'UN'],
    holidays: [
      'FIXED:01-01',
      'FIXED:01-26',
      'EASTER_FRIDAY',
      'EASTER_MONDAY',
      'FIXED:04-25',
      'FIXED:12-25',
      'FIXED:12-26',
    ],
    workweek: [1, 2, 3, 4, 5],
    currency: 'AUD',
    currencySymbol: '$',
    regulator: 'AUSTRAC',
  },

  // New Zealand (FIU)
  NZ: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 5000,
      enhancedDdRequired: 50000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 4000, max: 5000 },
    },
    deadlines: {
      ttrSubmission: 10,
      smrSubmission: 3,
    },
    screeningSources: ['UN', 'NZ_FIU'],
    holidays: [
      'FIXED:01-01',
      'FIXED:02-06',
      'EASTER_FRIDAY',
      'EASTER_MONDAY',
      'FIXED:04-25',
      'FIXED:12-25',
      'FIXED:12-26',
    ],
    workweek: [1, 2, 3, 4, 5],
    currency: 'NZD',
    currencySymbol: '$',
    regulator: 'NZ_FIU',
  },

  // United Kingdom (FCA/NCA)
  UK: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 1000,
      enhancedDdRequired: 25000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 8000, max: 10000 },
    },
    deadlines: {
      ttrSubmission: 14,
      smrSubmission: 7,
    },
    screeningSources: ['UK_HMT', 'OFSI', 'UN', 'EU'],
    holidays: [
      'FIXED:01-01',
      'EASTER_FRIDAY',
      'EASTER_MONDAY',
      'FIRST_MON_MAY',
      'LAST_MON_MAY',
      'LAST_MON_AUG',
      'FIXED:12-25',
      'FIXED:12-26',
    ],
    workweek: [1, 2, 3, 4, 5],
    currency: 'GBP',
    currencySymbol: '£',
    regulator: 'FCA',
  },

  // United States (FinCEN)
  US: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 3000,
      enhancedDdRequired: 25000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 8000, max: 10000 },
    },
    deadlines: {
      ttrSubmission: 15,
      smrSubmission: 30,
    },
    screeningSources: ['OFAC', 'UN'],
    holidays: [
      'FIXED:01-01',
      'THIRD_MON_JAN',
      'THIRD_MON_FEB',
      'LAST_MON_MAY',
      'FIXED:07-04',
      'FIRST_MON_SEP',
      'FOURTH_THU_NOV',
      'FIXED:12-25',
    ],
    workweek: [1, 2, 3, 4, 5],
    currency: 'USD',
    currencySymbol: '$',
    regulator: 'FinCEN',
  },

  // European Union (AMLD)
  EU: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 1000,
      enhancedDdRequired: 15000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 8000, max: 10000 },
    },
    deadlines: {
      ttrSubmission: 14,
      smrSubmission: 7,
    },
    screeningSources: ['EU_SANCTIONS', 'UN'],
    holidays: [],
    workweek: [1, 2, 3, 4, 5],
    currency: 'EUR',
    currencySymbol: '€',
    regulator: 'AMLD',
  },

  // Singapore (MAS)
  SG: {
    thresholds: {
      ttrRequired: 20000,
      kycRequired: 5000,
      enhancedDdRequired: 50000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 15000, max: 20000 },
    },
    deadlines: {
      ttrSubmission: 15,
      smrSubmission: 15,
    },
    screeningSources: ['UN', 'MAS_SANCTIONS'],
    holidays: [
      'FIXED:01-01',
      'CHINESE_NEW_YEAR_1',
      'CHINESE_NEW_YEAR_2',
      'EASTER_FRIDAY',
      'FIXED:05-01',
      'VESAK_DAY',
      'HARI_RAYA_PUASA',
      'FIXED:08-09',
      'HARI_RAYA_HAJI',
      'DEEPAVALI',
      'FIXED:12-25',
    ],
    workweek: [1, 2, 3, 4, 5],
    currency: 'SGD',
    currencySymbol: '$',
    regulator: 'MAS',
  },
};

function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key as keyof T];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

export function getTenantConfig(
  region: string,
  tenantSettings: Record<string, unknown> = {}
): RegionalConfig {
  const regionalDefaults = REGIONAL_CONFIGS[region] || REGIONAL_CONFIGS.AU;
  return deepMerge(regionalDefaults as unknown as Record<string, unknown>, tenantSettings) as unknown as RegionalConfig;
}

export function getDefaultRegion(): string {
  return 'AU';
}
