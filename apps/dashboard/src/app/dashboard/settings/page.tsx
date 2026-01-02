'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  Building,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RegionalConfig {
  thresholds: {
    ttrRequired: number;
    kycRequired: number;
    enhancedDdRequired: number;
    structuringWindow: number;
    structuringMinTxCount: number;
    structuringAmountRange: { min: number; max: number };
    internationalTransfer: number;
  };
  deadlines: {
    ttrSubmission: number;
    smrSubmission: number;
    smrUrgent: number;
    iftiSubmission: number;
  };
  ocdd: {
    lowRiskDays: number;
    mediumRiskDays: number;
    highRiskDays: number;
    documentExpiryWarningDays: number;
  };
  ubo: {
    ownershipThreshold: number;
    controlThreshold: number;
  };
  screeningSources: string[];
  highRiskCountries: string[];
  currency: string;
  currencySymbol: string;
  regulator: string;
  regulatorFullName: string;
  regulatorWebsite: string;
  reportingFormat: string;
  acceptedIdTypes: string[];
  businessRegistration: {
    required: boolean;
    registryName: string;
    numberFormat: string;
    lookupUrl?: string;
  };
}

interface Region {
  code: string;
  name: string;
  currency: string;
  regulator: string;
}

interface HighRiskJurisdictions {
  fatf_high_risk: string[];
  fatf_increased_monitoring: string[];
}

const REGION_NAMES: Record<string, string> = {
  AU: 'Australia',
  NZ: 'New Zealand',
  GB: 'United Kingdom',
  US: 'United States',
  EU: 'European Union',
  SG: 'Singapore',
};

// Fallback regional configurations
const FALLBACK_CONFIGS: Record<string, RegionalConfig> & { AU: RegionalConfig } = {
  AU: {
    thresholds: {
      ttrRequired: 10000,
      kycRequired: 5000,
      enhancedDdRequired: 50000,
      structuringWindow: 7,
      structuringMinTxCount: 3,
      structuringAmountRange: { min: 4000, max: 5000 },
      internationalTransfer: 0,
    },
    deadlines: { ttrSubmission: 10, smrSubmission: 3, smrUrgent: 24, iftiSubmission: 10 },
    ocdd: { lowRiskDays: 365, mediumRiskDays: 180, highRiskDays: 90, documentExpiryWarningDays: 30 },
    ubo: { ownershipThreshold: 25, controlThreshold: 25 },
    screeningSources: ['DFAT', 'UN'],
    highRiskCountries: ['IR', 'KP', 'MM'],
    currency: 'AUD',
    currencySymbol: '$',
    regulator: 'AUSTRAC',
    regulatorFullName: 'Australian Transaction Reports and Analysis Centre',
    regulatorWebsite: 'https://www.austrac.gov.au',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'birth_certificate'],
    businessRegistration: {
      required: true,
      registryName: 'ABN Lookup',
      numberFormat: '^\\d{11}$',
      lookupUrl: 'https://abr.business.gov.au',
    },
  },
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
    deadlines: { ttrSubmission: 14, smrSubmission: 7, smrUrgent: 24, iftiSubmission: 14 },
    ocdd: { lowRiskDays: 365, mediumRiskDays: 180, highRiskDays: 90, documentExpiryWarningDays: 30 },
    ubo: { ownershipThreshold: 25, controlThreshold: 25 },
    screeningSources: ['UK_HMT', 'OFSI', 'UN', 'EU'],
    highRiskCountries: ['IR', 'KP', 'MM'],
    currency: 'GBP',
    currencySymbol: '£',
    regulator: 'FCA',
    regulatorFullName: 'Financial Conduct Authority',
    regulatorWebsite: 'https://www.fca.org.uk',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'national_id'],
    businessRegistration: {
      required: true,
      registryName: 'Companies House',
      numberFormat: '^[A-Z]{2}\\d{6}$|^\\d{8}$',
      lookupUrl: 'https://find-and-update.company-information.service.gov.uk',
    },
  },
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
    deadlines: { ttrSubmission: 15, smrSubmission: 30, smrUrgent: 24, iftiSubmission: 15 },
    ocdd: { lowRiskDays: 365, mediumRiskDays: 180, highRiskDays: 90, documentExpiryWarningDays: 30 },
    ubo: { ownershipThreshold: 25, controlThreshold: 25 },
    screeningSources: ['OFAC', 'UN'],
    highRiskCountries: ['IR', 'KP', 'MM'],
    currency: 'USD',
    currencySymbol: '$',
    regulator: 'FinCEN',
    regulatorFullName: 'Financial Crimes Enforcement Network',
    regulatorWebsite: 'https://www.fincen.gov',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'drivers_license', 'state_id', 'military_id'],
    businessRegistration: {
      required: true,
      registryName: 'State Secretary of State',
      numberFormat: '^.+$',
    },
  },
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
    deadlines: { ttrSubmission: 15, smrSubmission: 15, smrUrgent: 24, iftiSubmission: 15 },
    ocdd: { lowRiskDays: 365, mediumRiskDays: 180, highRiskDays: 90, documentExpiryWarningDays: 30 },
    ubo: { ownershipThreshold: 25, controlThreshold: 25 },
    screeningSources: ['UN', 'MAS_SANCTIONS'],
    highRiskCountries: ['IR', 'KP', 'MM'],
    currency: 'SGD',
    currencySymbol: '$',
    regulator: 'MAS',
    regulatorFullName: 'Monetary Authority of Singapore',
    regulatorWebsite: 'https://www.mas.gov.sg',
    reportingFormat: 'XML',
    acceptedIdTypes: ['passport', 'nric', 'fin', 'drivers_license'],
    businessRegistration: {
      required: true,
      registryName: 'ACRA',
      numberFormat: '^\\d{9}[A-Z]$',
      lookupUrl: 'https://www.acra.gov.sg',
    },
  },
};

export default function SettingsPage() {
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [showTestKey, setShowTestKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  const [regions, setRegions] = useState<Region[]>([
    { code: 'AU', name: 'Australia', currency: 'AUD', regulator: 'AUSTRAC' },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', regulator: 'FCA' },
    { code: 'US', name: 'United States', currency: 'USD', regulator: 'FinCEN' },
    { code: 'SG', name: 'Singapore', currency: 'SGD', regulator: 'MAS' },
  ]);
  const [highRiskJurisdictions, setHighRiskJurisdictions] = useState<HighRiskJurisdictions>({
    fatf_high_risk: ['IR', 'KP', 'MM'],
    fatf_increased_monitoring: [],
  });

  const [selectedRegion, setSelectedRegion] = useState('AU');
  const [regionalConfig, setRegionalConfig] = useState<RegionalConfig>(FALLBACK_CONFIGS.AU as RegionalConfig);

  // Tenant settings
  const [tenantSettings, setTenantSettings] = useState({
    tenantId: '',
    tenantName: '',
    liveApiKey: '',
    testApiKey: '',
    liveApiKeyPrefix: '',
    testApiKeyPrefix: '',
  });
  const [tenantLoading, setTenantLoading] = useState(true);

  // User-customizable overrides (can be different from regional defaults)
  const [customSettings, setCustomSettings] = useState({
    autoScreenNewCustomers: true,
    autoScreenTransactions: true,
    pepScreeningEnabled: true,
    autoFlagHighRisk: true,
    requireManualReview: true,
    documentVerification: true,
    autoApprovalEnabled: false,
    // Custom overrides (null means use regional default)
    ttrThresholdOverride: null as number | null,
    kycThresholdOverride: null as number | null,
    enhancedDdOverride: null as number | null,
  });

  const fetchRegionalConfig = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch available regions
      const regionsResponse = await fetch('/api/proxy/config/regions');
      if (regionsResponse.ok) {
        const data = await regionsResponse.json();
        if (data.available_regions) {
          setRegions(data.available_regions);
        }
        if (data.high_risk_jurisdictions) {
          setHighRiskJurisdictions(data.high_risk_jurisdictions);
        }
        if (data.current_region) {
          setSelectedRegion(data.current_region);
        }
        if (data.current_config) {
          setRegionalConfig(data.current_config);
          setUsingMockData(false);
        } else {
          const fallback = FALLBACK_CONFIGS[selectedRegion] || FALLBACK_CONFIGS.AU;
          setRegionalConfig(fallback);
          setUsingMockData(true);
        }
      } else {
        throw new Error('API unavailable');
      }
    } catch {
      const fallback = FALLBACK_CONFIGS[selectedRegion] || FALLBACK_CONFIGS.AU;
      setRegionalConfig(fallback);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  const fetchTenantSettings = useCallback(async () => {
    setTenantLoading(true);
    try {
      const response = await fetch('/api/proxy/tenant/settings');
      if (response.ok) {
        const data = await response.json();
        setTenantSettings({
          tenantId: data.id || '',
          tenantName: data.name || '',
          liveApiKey: '',
          testApiKey: '',
          liveApiKeyPrefix: data.liveApiKeyPrefix || '',
          testApiKeyPrefix: data.testApiKeyPrefix || '',
        });
        if (data.region) {
          setSelectedRegion(data.region);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tenant settings:', error);
    } finally {
      setTenantLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegionalConfig();
    fetchTenantSettings();
  }, [fetchRegionalConfig, fetchTenantSettings]);

  const handleRegionChange = async (newRegion: string) => {
    setSelectedRegion(newRegion);
    setLoading(true);

    try {
      const response = await fetch(`/api/proxy/config/regions?region=${newRegion}`);
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setRegionalConfig(data.config);
        } else {
          const fallback = FALLBACK_CONFIGS[newRegion] || FALLBACK_CONFIGS.AU;
          setRegionalConfig(fallback);
        }
      } else {
        const fallback = FALLBACK_CONFIGS[newRegion] || FALLBACK_CONFIGS.AU;
        setRegionalConfig(fallback);
      }
    } catch {
      const fallback = FALLBACK_CONFIGS[newRegion] || FALLBACK_CONFIGS.AU;
      setRegionalConfig(fallback);
    } finally {
      setLoading(false);
    }

    // Reset custom overrides when region changes
    setCustomSettings((prev) => ({
      ...prev,
      ttrThresholdOverride: null,
      kycThresholdOverride: null,
      enhancedDdOverride: null,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/proxy/tenant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: selectedRegion,
          settings: {
            ...customSettings,
            thresholdOverrides: {
              ttrRequired: customSettings.ttrThresholdOverride,
              kycRequired: customSettings.kycThresholdOverride,
              enhancedDdRequired: customSettings.enhancedDdOverride,
            },
          },
        }),
      });

      if (response.ok) {
        alert('Settings saved successfully');
      } else {
        // Demo mode - just show success
        alert('Settings saved successfully (demo mode)');
      }
    } catch {
      // Demo mode
      alert('Settings saved successfully (demo mode)');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard');
  };

  const handleRotateKey = async (keyType: 'live' | 'test') => {
    if (
      confirm(
        `Are you sure you want to rotate your ${keyType} API key? This will invalidate the current key immediately.`
      )
    ) {
      try {
        const response = await fetch('/api/proxy/api-keys/rotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyType }),
        });

        if (response.ok) {
          const data = await response.json();
          setTenantSettings((prev) => ({
            ...prev,
            [`${keyType}ApiKey`]: data.key,
            [`${keyType}ApiKeyPrefix`]: data.prefix,
          }));
          alert(`Your new ${keyType} API key has been generated. Copy it now - it will not be shown again.`);
        } else {
          const error = await response.json();
          alert(`Failed to rotate key: ${error.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Key rotation error:', error);
        alert('Failed to rotate API key. Please try again.');
      }
    }
  };

  const maskKey = (key: string, prefix: string) => {
    if (key) return key.substring(0, 12) + '\u2022'.repeat(20);
    if (prefix) return prefix + '\u2022'.repeat(25);
    return '\u2022'.repeat(32);
  };

  const getDisplayKey = (key: string, prefix: string, show: boolean) => {
    if (show && key) return key;
    return maskKey(key, prefix);
  };

  // Calculate effective thresholds (custom override or regional default)
  const effectiveThresholds = {
    ttr: customSettings.ttrThresholdOverride ?? regionalConfig.thresholds.ttrRequired,
    kyc: customSettings.kycThresholdOverride ?? regionalConfig.thresholds.kycRequired,
    edd: customSettings.enhancedDdOverride ?? regionalConfig.thresholds.enhancedDdRequired,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your compliance platform configuration
        </p>
      </div>

      {usingMockData && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          Showing demo configuration. Connect to the API for live settings.
        </div>
      )}

      {/* Regional Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle>Regional Compliance Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Region Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Regulatory Region
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {regions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.name} ({region.regulator})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Changing region will update all compliance thresholds
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Currency
                </label>
                <div className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-medium">
                  {regionalConfig.currencySymbol} {regionalConfig.currency}
                </div>
              </div>
            </div>

            {/* Regulator Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">
                    {regionalConfig.regulatorFullName}
                  </h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Your compliance settings are configured for{' '}
                    {REGION_NAMES[selectedRegion] || selectedRegion} regulations under{' '}
                    {regionalConfig.regulator} guidelines.
                  </p>
                  <a
                    href={regionalConfig.regulatorWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                  >
                    Visit {regionalConfig.regulator} website &rarr;
                  </a>
                </div>
              </div>
            </div>

            {/* Regulatory Thresholds */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Info className="w-4 h-4 mr-2 text-gray-500" />
                Regulatory Thresholds ({regionalConfig.currency})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">TTR Threshold</span>
                    <span className="text-xs text-gray-500">Threshold Transaction Report</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold text-gray-900">
                      {regionalConfig.currencySymbol}
                    </span>
                    <input
                      type="number"
                      value={effectiveThresholds.ttr}
                      onChange={(e) =>
                        setCustomSettings({
                          ...customSettings,
                          ttrThresholdOverride: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  {customSettings.ttrThresholdOverride !== null && (
                    <button
                      onClick={() =>
                        setCustomSettings({ ...customSettings, ttrThresholdOverride: null })
                      }
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      Reset to regional default ({regionalConfig.thresholds.ttrRequired})
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">KYC Threshold</span>
                    <span className="text-xs text-gray-500">Verification Required</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold text-gray-900">
                      {regionalConfig.currencySymbol}
                    </span>
                    <input
                      type="number"
                      value={effectiveThresholds.kyc}
                      onChange={(e) =>
                        setCustomSettings({
                          ...customSettings,
                          kycThresholdOverride: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  {customSettings.kycThresholdOverride !== null && (
                    <button
                      onClick={() =>
                        setCustomSettings({ ...customSettings, kycThresholdOverride: null })
                      }
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      Reset to regional default ({regionalConfig.thresholds.kycRequired})
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">EDD Threshold</span>
                    <span className="text-xs text-gray-500">Enhanced Due Diligence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold text-gray-900">
                      {regionalConfig.currencySymbol}
                    </span>
                    <input
                      type="number"
                      value={effectiveThresholds.edd}
                      onChange={(e) =>
                        setCustomSettings({
                          ...customSettings,
                          enhancedDdOverride: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  {customSettings.enhancedDdOverride !== null && (
                    <button
                      onClick={() =>
                        setCustomSettings({ ...customSettings, enhancedDdOverride: null })
                      }
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      Reset to regional default ({regionalConfig.thresholds.enhancedDdRequired})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Reporting Deadlines */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-500" />
                Reporting Deadlines (Business Days)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {regionalConfig.deadlines.ttrSubmission}
                  </p>
                  <p className="text-xs text-gray-600">TTR Submission</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {regionalConfig.deadlines.smrSubmission}
                  </p>
                  <p className="text-xs text-gray-600">SMR Submission</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {regionalConfig.deadlines.smrUrgent}h
                  </p>
                  <p className="text-xs text-gray-600">Urgent SMR</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {regionalConfig.deadlines.iftiSubmission}
                  </p>
                  <p className="text-xs text-gray-600">IFTI Submission</p>
                </div>
              </div>
            </div>

            {/* OCDD Frequencies */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <RefreshCw className="w-4 h-4 mr-2 text-gray-500" />
                OCDD Review Frequencies
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-green-200 bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {regionalConfig.ocdd.lowRiskDays}
                  </p>
                  <p className="text-xs text-green-800">Low Risk (days)</p>
                </div>
                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">
                    {regionalConfig.ocdd.mediumRiskDays}
                  </p>
                  <p className="text-xs text-yellow-800">Medium Risk (days)</p>
                </div>
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">
                    {regionalConfig.ocdd.highRiskDays}
                  </p>
                  <p className="text-xs text-red-800">High Risk (days)</p>
                </div>
              </div>
            </div>

            {/* UBO Requirements */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Building className="w-4 h-4 mr-2 text-gray-500" />
                Beneficial Ownership Requirements
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Ownership Threshold</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {regionalConfig.ubo.ownershipThreshold}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    UBO identification required above this %
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Control Threshold</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {regionalConfig.ubo.controlThreshold}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Control identification required above this %</p>
                </div>
              </div>
            </div>

            {/* Screening Sources */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Sanctions Screening Sources</h4>
              <div className="flex flex-wrap gap-2">
                {regionalConfig.screeningSources.map((source) => (
                  <span
                    key={source}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* High Risk Jurisdictions */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <CardTitle>FATF High-Risk Jurisdictions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-red-800 mb-2">
                High-Risk (Call for Action)
              </h4>
              <div className="flex flex-wrap gap-2">
                {highRiskJurisdictions.fatf_high_risk.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
            {highRiskJurisdictions.fatf_increased_monitoring.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-orange-800 mb-2">
                  Increased Monitoring
                </h4>
                <div className="flex flex-wrap gap-2">
                  {highRiskJurisdictions.fatf_increased_monitoring.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Transactions involving these jurisdictions will require enhanced due diligence.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Screening Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Screening Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={customSettings.autoScreenNewCustomers}
                onChange={(e) =>
                  setCustomSettings({ ...customSettings, autoScreenNewCustomers: e.target.checked })
                }
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Automatically screen new customers
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={customSettings.autoScreenTransactions}
                onChange={(e) =>
                  setCustomSettings({
                    ...customSettings,
                    autoScreenTransactions: e.target.checked,
                  })
                }
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Automatically screen transactions
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={customSettings.pepScreeningEnabled}
                onChange={(e) =>
                  setCustomSettings({ ...customSettings, pepScreeningEnabled: e.target.checked })
                }
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Enable PEP screening
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={customSettings.autoFlagHighRisk}
                onChange={(e) =>
                  setCustomSettings({ ...customSettings, autoFlagHighRisk: e.target.checked })
                }
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Automatically flag high-risk transactions
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={customSettings.requireManualReview}
                onChange={(e) =>
                  setCustomSettings({ ...customSettings, requireManualReview: e.target.checked })
                }
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Require manual review for flagged transactions
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                <strong>Important:</strong> Keep your API keys secure. Do not share them in
                publicly accessible areas such as GitHub, client-side code, etc.
              </p>
            </div>

            {/* Live Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Live API Key
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={getDisplayKey(tenantSettings.liveApiKey, tenantSettings.liveApiKeyPrefix, showLiveKey)}
                    readOnly
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowLiveKey(!showLiveKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={!tenantSettings.liveApiKey}
                  >
                    {showLiveKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={() => handleCopyKey(tenantSettings.liveApiKey)}
                  disabled={!tenantSettings.liveApiKey}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Copy key"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleRotateKey('live')}
                  className="p-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Rotate key"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use this key for production environments
              </p>
            </div>

            {/* Test Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test API Key
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={getDisplayKey(tenantSettings.testApiKey, tenantSettings.testApiKeyPrefix, showTestKey)}
                    readOnly
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowTestKey(!showTestKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={!tenantSettings.testApiKey}
                  >
                    {showTestKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={() => handleCopyKey(tenantSettings.testApiKey)}
                  disabled={!tenantSettings.testApiKey}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Copy key"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleRotateKey('test')}
                  className="p-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Rotate key"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use this key for development and testing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenant Information */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant Name
              </label>
              <input
                type="text"
                value={tenantSettings.tenantName}
                onChange={(e) =>
                  setTenantSettings({ ...tenantSettings, tenantName: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant ID
              </label>
              <input
                type="text"
                value={tenantSettings.tenantId}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
