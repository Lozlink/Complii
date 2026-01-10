export interface RegionalConfig {
  // Monetary thresholds (in local currency)
  thresholds: {
    ttrRequired: number;           // Threshold Transaction Report
    kycRequired: number;           // KYC verification required above this
    enhancedDdRequired: number;    // Enhanced Due Diligence threshold
    structuringWindow: number;     // Days to check for structuring
    structuringMinTxCount: number; // Min transactions to flag as structuring
    structuringAmountRange: {
      min: number;
      max: number;
    };
    internationalTransfer: number; // IFTI reporting threshold
  };

  // Reporting deadlines (in business days)
  deadlines: {
    ttrSubmission: number;         // Days to submit TTR
    smrSubmission: number;         // Days to submit SMR (standard)
    smrUrgent: number;             // Hours for terrorism-related SMR
    iftiSubmission: number;        // Days to submit IFTI
  };

  // OCDD (Ongoing Customer Due Diligence) frequencies
  ocdd: {
    lowRiskDays: number;           // Review frequency for low risk
    mediumRiskDays: number;        // Review frequency for medium risk
    highRiskDays: number;          // Review frequency for high risk
    documentExpiryWarningDays: number; // Days before expiry to warn
  };

  // UBO (Ultimate Beneficial Owner) requirements
  ubo: {
    ownershipThreshold: number;    // % ownership requiring identification
    controlThreshold: number;      // % control requiring identification
  };

  // Screening configuration
  screeningSources: string[];
  highRiskCountries: string[];     // ISO country codes

  // Business day configuration
  holidays: string[];
  workweek: number[];              // 0=Sunday, 1=Monday, etc.
  timezone: string;

  // Currency
  currency: string;
  currencySymbol: string;

  // Regulator information
  regulator: string;
  regulatorFullName: string;
  regulatorWebsite: string;
  reportingFormat: string;         // XML, JSON, CSV

  // Document requirements
  acceptedIdTypes: string[];
  idExpiryRequired: boolean;
  proofOfAddressMaxAgeDays: number;

  // Business registration
  businessRegistration: {
    required: boolean;
    registryName: string;
    numberFormat: string;          // Regex pattern
    lookupUrl?: string;
  };
}

// FATF High-Risk Jurisdictions (updated periodically)
export const FATF_HIGH_RISK_COUNTRIES = [
  'IR', // Iran
  'KP', // North Korea
  'MM', // Myanmar
];

export const FATF_INCREASED_MONITORING = [
  'BF', // Burkina Faso
  'CM', // Cameroon
  'CD', // DR Congo
  'HT', // Haiti
  'KE', // Kenya
  'ML', // Mali
  'MZ', // Mozambique
  'NG', // Nigeria
  'PH', // Philippines
  'SN', // Senegal
  'ZA', // South Africa
  'SS', // South Sudan
  'SY', // Syria
  'TZ', // Tanzania
  'VN', // Vietnam
  'YE', // Yemen
];

export const REGIONAL_CONFIGS: Record<string, RegionalConfig> = {
  // Australia (AUSTRAC)
  AU: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 5000,
      enhancedDdRequired: 50000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 7000, max: 9999 },
      internationalTransfer: 0, // All IFTIs reported
    },
    deadlines: {
      ttrSubmission: 10,
      smrSubmission: 3,
      smrUrgent: 24,
      iftiSubmission: 10,
    },
    ocdd: {
      lowRiskDays: 365,
      mediumRiskDays: 180,
      highRiskDays: 90,
      documentExpiryWarningDays: 30,
    },
    ubo: {
      ownershipThreshold: 25,
      controlThreshold: 25,
    },
    screeningSources: ['DFAT', 'UN'],
    highRiskCountries: [...FATF_HIGH_RISK_COUNTRIES, ...FATF_INCREASED_MONITORING],
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
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    currencySymbol: '$',
    regulator: 'AUSTRAC',
    regulatorFullName: 'Australian Transaction Reports and Analysis Centre',
    regulatorWebsite: 'https://www.austrac.gov.au',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'birth_certificate', 'citizenship_certificate', 'medicare_card'],
    idExpiryRequired: true,
    proofOfAddressMaxAgeDays: 90,
    businessRegistration: {
      required: true,
      registryName: 'ABN Lookup',
      numberFormat: '^\\d{11}$', // ABN is 11 digits
      lookupUrl: 'https://abr.business.gov.au',
    },
  },

  // New Zealand (FIU)
  NZ: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 5000,
      enhancedDdRequired: 50000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 7000, max: 9999 },
      internationalTransfer: 1000,
    },
    deadlines: {
      ttrSubmission: 10,
      smrSubmission: 3,
      smrUrgent: 24,
      iftiSubmission: 10,
    },
    ocdd: {
      lowRiskDays: 365,
      mediumRiskDays: 180,
      highRiskDays: 90,
      documentExpiryWarningDays: 30,
    },
    ubo: {
      ownershipThreshold: 25,
      controlThreshold: 25,
    },
    screeningSources: ['UN', 'NZ_DIA'],
    highRiskCountries: [...FATF_HIGH_RISK_COUNTRIES, ...FATF_INCREASED_MONITORING],
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
    timezone: 'Pacific/Auckland',
    currency: 'NZD',
    currencySymbol: '$',
    regulator: 'NZ_FIU',
    regulatorFullName: 'New Zealand Financial Intelligence Unit',
    regulatorWebsite: 'https://www.police.govt.nz/advice/financial-intelligence-unit',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'birth_certificate', 'citizenship_certificate'],
    idExpiryRequired: true,
    proofOfAddressMaxAgeDays: 90,
    businessRegistration: {
      required: true,
      registryName: 'New Zealand Companies Office',
      numberFormat: '^\\d{6,7}$', // NZBN
      lookupUrl: 'https://companies-register.companiesoffice.govt.nz',
    },
  },

  // United Kingdom (FCA/NCA)
  GB: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 1000,
      enhancedDdRequired: 25000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 8000, max: 10000 },
      internationalTransfer: 1000,
    },
    deadlines: {
      ttrSubmission: 14,
      smrSubmission: 7,
      smrUrgent: 24,
      iftiSubmission: 14,
    },
    ocdd: {
      lowRiskDays: 365,
      mediumRiskDays: 180,
      highRiskDays: 90,
      documentExpiryWarningDays: 30,
    },
    ubo: {
      ownershipThreshold: 25,
      controlThreshold: 25,
    },
    screeningSources: ['UK_HMT', 'OFSI', 'UN', 'EU'],
    highRiskCountries: [...FATF_HIGH_RISK_COUNTRIES, ...FATF_INCREASED_MONITORING],
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
    timezone: 'Europe/London',
    currency: 'GBP',
    currencySymbol: '£',
    regulator: 'FCA',
    regulatorFullName: 'Financial Conduct Authority',
    regulatorWebsite: 'https://www.fca.org.uk',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'national_id'],
    idExpiryRequired: true,
    proofOfAddressMaxAgeDays: 90,
    businessRegistration: {
      required: true,
      registryName: 'Companies House',
      numberFormat: '^[A-Z]{2}\\d{6}$|^\\d{8}$', // Company number
      lookupUrl: 'https://find-and-update.company-information.service.gov.uk',
    },
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
      internationalTransfer: 3000,
    },
    deadlines: {
      ttrSubmission: 15,
      smrSubmission: 30,
      smrUrgent: 24,
      iftiSubmission: 15,
    },
    ocdd: {
      lowRiskDays: 365,
      mediumRiskDays: 180,
      highRiskDays: 90,
      documentExpiryWarningDays: 30,
    },
    ubo: {
      ownershipThreshold: 25,
      controlThreshold: 25,
    },
    screeningSources: ['OFAC', 'UN'],
    highRiskCountries: [...FATF_HIGH_RISK_COUNTRIES, ...FATF_INCREASED_MONITORING],
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
    timezone: 'America/New_York',
    currency: 'USD',
    currencySymbol: '$',
    regulator: 'FinCEN',
    regulatorFullName: 'Financial Crimes Enforcement Network',
    regulatorWebsite: 'https://www.fincen.gov',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'state_id', 'military_id'],
    idExpiryRequired: true,
    proofOfAddressMaxAgeDays: 60,
    businessRegistration: {
      required: true,
      registryName: 'State Secretary of State',
      numberFormat: '^.+$', // Varies by state
    },
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
      internationalTransfer: 1000,
    },
    deadlines: {
      ttrSubmission: 14,
      smrSubmission: 7,
      smrUrgent: 24,
      iftiSubmission: 14,
    },
    ocdd: {
      lowRiskDays: 365,
      mediumRiskDays: 180,
      highRiskDays: 90,
      documentExpiryWarningDays: 30,
    },
    ubo: {
      ownershipThreshold: 25,
      controlThreshold: 25,
    },
    screeningSources: ['EU_SANCTIONS', 'UN'],
    highRiskCountries: [...FATF_HIGH_RISK_COUNTRIES, ...FATF_INCREASED_MONITORING],
    holidays: [],
    workweek: [1, 2, 3, 4, 5],
    timezone: 'Europe/Brussels',
    currency: 'EUR',
    currencySymbol: '€',
    regulator: 'AMLD',
    regulatorFullName: 'Anti-Money Laundering Directive',
    regulatorWebsite: 'https://ec.europa.eu/info/business-economy-euro/banking-and-finance/financial-supervision-and-risk-management/anti-money-laundering-and-countering-financing-terrorism_en',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'national_id', 'drivers_license'],
    idExpiryRequired: true,
    proofOfAddressMaxAgeDays: 90,
    businessRegistration: {
      required: true,
      registryName: 'National Business Registry',
      numberFormat: '^.+$', // Varies by country
    },
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
      internationalTransfer: 5000,
    },
    deadlines: {
      ttrSubmission: 15,
      smrSubmission: 15,
      smrUrgent: 24,
      iftiSubmission: 15,
    },
    ocdd: {
      lowRiskDays: 365,
      mediumRiskDays: 180,
      highRiskDays: 90,
      documentExpiryWarningDays: 30,
    },
    ubo: {
      ownershipThreshold: 25,
      controlThreshold: 25,
    },
    screeningSources: ['UN', 'MAS_SANCTIONS'],
    highRiskCountries: [...FATF_HIGH_RISK_COUNTRIES, ...FATF_INCREASED_MONITORING],
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
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    currencySymbol: '$',
    regulator: 'MAS',
    regulatorFullName: 'Monetary Authority of Singapore',
    regulatorWebsite: 'https://www.mas.gov.sg',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'nric', 'fin', 'drivers_license'],
    idExpiryRequired: true,
    proofOfAddressMaxAgeDays: 90,
    businessRegistration: {
      required: true,
      registryName: 'ACRA',
      numberFormat: '^\\d{9}[A-Z]$', // UEN format
      lookupUrl: 'https://www.acra.gov.sg',
    },
  },
};

// Alias UK to GB for compatibility
REGIONAL_CONFIGS.UK = REGIONAL_CONFIGS.GB;

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

export function getAvailableRegions(): Array<{
  code: string;
  name: string;
  currency: string;
  regulator: string;
}> {
  const regionNames: Record<string, string> = {
    AU: 'Australia',
    NZ: 'New Zealand',
    GB: 'United Kingdom',
    US: 'United States',
    EU: 'European Union',
    SG: 'Singapore',
  };

  return Object.entries(REGIONAL_CONFIGS)
    .filter(([code]) => code !== 'UK') // Exclude UK alias
    .map(([code, config]) => ({
      code,
      name: regionNames[code] || code,
      currency: config.currency,
      regulator: config.regulator,
    }));
}

export function isHighRiskCountry(countryCode: string, region: string): boolean {
  const config = REGIONAL_CONFIGS[region] || REGIONAL_CONFIGS.AU;
  return config.highRiskCountries.includes(countryCode.toUpperCase());
}

export function getOcddFrequencyDays(riskLevel: string, region: string): number {
  const config = REGIONAL_CONFIGS[region] || REGIONAL_CONFIGS.AU;
  switch (riskLevel) {
    case 'high':
      return config.ocdd.highRiskDays;
    case 'medium':
      return config.ocdd.mediumRiskDays;
    case 'low':
    default:
      return config.ocdd.lowRiskDays;
  }
}

export function getReportingDeadline(
  reportType: 'ttr' | 'smr' | 'smr_urgent' | 'ifti',
  region: string
): number {
  const config = REGIONAL_CONFIGS[region] || REGIONAL_CONFIGS.AU;
  switch (reportType) {
    case 'ttr':
      return config.deadlines.ttrSubmission;
    case 'smr':
      return config.deadlines.smrSubmission;
    case 'smr_urgent':
      return config.deadlines.smrUrgent;
    case 'ifti':
      return config.deadlines.iftiSubmission;
    default:
      return config.deadlines.smrSubmission;
  }
}
