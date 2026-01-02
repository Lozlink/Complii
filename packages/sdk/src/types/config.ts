export interface RegionalThresholds {
  ttrRequired: number;
  kycRequired: number;
  enhancedDdRequired: number;
  structuringWindow: number;
  structuringMinTxCount: number;
  structuringAmountRange: {
    min: number;
    max: number;
  };
  internationalTransfer: number;
}

export interface ReportingDeadlines {
  ttrSubmission: number;
  smrSubmission: number;
  smrUrgent: number;
  iftiSubmission: number;
}

export interface OcddSettings {
  lowRiskDays: number;
  mediumRiskDays: number;
  highRiskDays: number;
  documentExpiryWarningDays: number;
}

export interface UboSettings {
  ownershipThreshold: number;
  controlThreshold: number;
}

export interface BusinessRegistrationSettings {
  required: boolean;
  registryName: string;
  numberFormat: string;
  lookupUrl?: string;
}

export interface RegionalConfig {
  thresholds: RegionalThresholds;
  deadlines: ReportingDeadlines;
  ocdd: OcddSettings;
  ubo: UboSettings;
  screeningSources: string[];
  highRiskCountries: string[];
  holidays: string[];
  workweek: number[];
  timezone: string;
  currency: string;
  currencySymbol: string;
  regulator: string;
  regulatorFullName: string;
  regulatorWebsite: string;
  reportingFormat: string;
  acceptedIdTypes: string[];
  idExpiryRequired: boolean;
  proofOfAddressMaxAgeDays: number;
  businessRegistration: BusinessRegistrationSettings;
}

export interface RegionSummary {
  code: string;
  name: string;
  currency: string;
  regulator: string;
}

export interface HighRiskJurisdictions {
  fatfHighRisk: string[];
  fatfIncreasedMonitoring: string[];
}

export interface ConfigResponse {
  availableRegions: RegionSummary[];
  currentRegion: string;
  currentConfig: RegionalConfig;
  highRiskJurisdictions: HighRiskJurisdictions;
}
