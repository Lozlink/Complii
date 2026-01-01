'use client';

import { useState } from 'react';
import { Save, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function SettingsPage() {
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [showTestKey, setShowTestKey] = useState(false);

  // Mock tenant settings
  const settings = {
    tenantId: 'tnt_1234567890',
    tenantName: 'Acme Financial Services',
    liveApiKey: 'complii_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testApiKey: 'complii_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    config: {
      region: 'AU',
      currency: 'AUD',
      riskThresholds: {
        low: 30,
        medium: 60,
        high: 100,
      },
      screeningSettings: {
        autoScreenNewCustomers: true,
        autoScreenTransactions: true,
        pepScreeningEnabled: true,
        sanctionsListsincluded: ['DFAT', 'UN'],
      },
      transactionSettings: {
        ttrThreshold: 10000,
        autoFlagHighRisk: true,
        requireManualReview: true,
      },
      kycSettings: {
        documentVerification: true,
        identityProviders: ['stripe_identity'],
        autoApprovalEnabled: false,
      },
    },
  };

  const [formData, setFormData] = useState(settings);

  const handleSave = () => {
    console.log('Saving settings:', formData);
    alert('Settings saved successfully');
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard');
  };

  const handleRotateKey = (keyType: 'live' | 'test') => {
    if (confirm(`Are you sure you want to rotate your ${keyType} API key? This will invalidate the current key.`)) {
      console.log(`Rotating ${keyType} key`);
      alert(`${keyType} API key rotated successfully`);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    return key.substring(0, 12) + '•'.repeat(20);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage your compliance platform configuration</p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                <strong>Important:</strong> Keep your API keys secure. Do not share them in publicly
                accessible areas such as GitHub, client-side code, etc.
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
                    type={showLiveKey ? 'text' : 'password'}
                    value={showLiveKey ? settings.liveApiKey : maskKey(settings.liveApiKey)}
                    readOnly
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowLiveKey(!showLiveKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showLiveKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={() => handleCopyKey(settings.liveApiKey)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
              <p className="text-xs text-gray-500 mt-1">Use this key for production environments</p>
            </div>

            {/* Test Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test API Key
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    type={showTestKey ? 'text' : 'password'}
                    value={showTestKey ? settings.testApiKey : maskKey(settings.testApiKey)}
                    readOnly
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowTestKey(!showTestKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showTestKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={() => handleCopyKey(settings.testApiKey)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
              <p className="text-xs text-gray-500 mt-1">Use this key for development and testing</p>
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
                value={formData.tenantName}
                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant ID
              </label>
              <input
                type="text"
                value={settings.tenantId}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region
              </label>
              <select
                value={formData.config.region}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, region: e.target.value },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="AU">Australia</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="SG">Singapore</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={formData.config.currency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, currency: e.target.value },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="USD">USD - US Dollar</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="EUR">EUR - Euro</option>
                <option value="SGD">SGD - Singapore Dollar</option>
              </select>
            </div>
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
                checked={formData.config.screeningSettings.autoScreenNewCustomers}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      screeningSettings: {
                        ...formData.config.screeningSettings,
                        autoScreenNewCustomers: e.target.checked,
                      },
                    },
                  })
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
                checked={formData.config.screeningSettings.autoScreenTransactions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      screeningSettings: {
                        ...formData.config.screeningSettings,
                        autoScreenTransactions: e.target.checked,
                      },
                    },
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
                checked={formData.config.screeningSettings.pepScreeningEnabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      screeningSettings: {
                        ...formData.config.screeningSettings,
                        pepScreeningEnabled: e.target.checked,
                      },
                    },
                  })
                }
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Enable PEP screening
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TTR Threshold (in {formData.config.currency})
              </label>
              <input
                type="number"
                value={formData.config.transactionSettings.ttrThreshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      transactionSettings: {
                        ...formData.config.transactionSettings,
                        ttrThreshold: Number(e.target.value),
                      },
                    },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Transactions above this amount require Threshold Transaction Reports
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.config.transactionSettings.autoFlagHighRisk}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: {
                        ...formData.config,
                        transactionSettings: {
                          ...formData.config.transactionSettings,
                          autoFlagHighRisk: e.target.checked,
                        },
                      },
                    })
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
                  checked={formData.config.transactionSettings.requireManualReview}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: {
                        ...formData.config,
                        transactionSettings: {
                          ...formData.config.transactionSettings,
                          requireManualReview: e.target.checked,
                        },
                      },
                    })
                  }
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">
                  Require manual review for flagged transactions
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Save className="w-5 h-5 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
