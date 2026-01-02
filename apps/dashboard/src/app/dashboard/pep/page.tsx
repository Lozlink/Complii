'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, CheckCircle, User, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface MatchDetails {
  name?: string;
  position: string;
  category: string;
  country?: string;
  riskLevel: string;
}

interface PepScreening {
  id: string;
  name: string;
  country: string;
  isPep: boolean;
  matchScore: number;
  status: string;
  matchDetails?: MatchDetails;
  screenedAt: string;
}

export default function PepPage() {
  const [screeningHistory, setScreeningHistory] = useState<PepScreening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screening, setScreening] = useState(false);

  const [screeningName, setScreeningName] = useState('');
  const [screeningCountry, setScreeningCountry] = useState('');

  const fetchScreeningHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/pep/history?limit=50');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();

      // Transform API response to match component format
      const history = (data.data || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.screenedName,
        country: s.screenedCountry || 'Unknown',
        isPep: s.isPep,
        matchScore: s.matchScore || 0,
        status: s.status || 'clear',
        matchDetails: s.matchedDetails as MatchDetails | undefined,
        screenedAt: s.screenedAt,
      }));

      setScreeningHistory(history);
    } catch {
      setError('Failed to load screening history. Please try again.');
      setScreeningHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreeningHistory();
  }, [fetchScreeningHistory]);

  const handleScreen = async () => {
    if (!screeningName) return;

    setScreening(true);
    try {
      const response = await fetch('/api/proxy/pep/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: screeningName,
          country: screeningCountry || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Clear form
        setScreeningName('');
        setScreeningCountry('');

        // Refresh history from API
        await fetchScreeningHistory();

        if (result.isPep) {
          alert(`PEP identified! Review the match details below.`);
        } else {
          alert('No PEP match found');
        }
      } else {
        throw new Error('Screening failed');
      }
    } catch {
      alert('Failed to perform screening. Please try again.');
    } finally {
      setScreening(false);
    }
  };

  const stats = {
    total: screeningHistory.length,
    peps: screeningHistory.filter((s) => s.isPep).length,
    pepRate: screeningHistory.length > 0
      ? ((screeningHistory.filter((s) => s.isPep).length / screeningHistory.length) * 100).toFixed(1)
      : '0',
  };

  const getResultBadge = (isPep: boolean) => {
    if (isPep) {
      return {
        class: 'bg-orange-100 text-orange-800',
        icon: AlertTriangle,
        text: 'PEP Identified',
      };
    }
    return {
      class: 'bg-green-100 text-green-800',
      icon: CheckCircle,
      text: 'Not a PEP',
    };
  };

  const getRiskBadge = (risk: string) => {
    const badges: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[risk] || badges.low;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">PEP Screening</h1>
        <p className="mt-2 text-gray-600">
          Screen for Politically Exposed Persons and their close associates
        </p>
      </div>

      {/* Screening Form */}
      <Card>
        <CardHeader>
          <CardTitle>New PEP Screening</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <User className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-orange-900">
                  What is a Politically Exposed Person (PEP)?
                </h4>
                <p className="text-sm text-orange-800 mt-1">
                  PEPs are individuals who hold or have held prominent public positions. This
                  includes heads of state, senior politicians, senior government officials, judicial
                  or military officials, senior executives of state-owned corporations, and
                  important political party officials. Enhanced due diligence is required for PEPs.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={screeningName}
                onChange={(e) => setScreeningName(e.target.value)}
                placeholder="Enter full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <select
                value={screeningCountry}
                onChange={(e) => setScreeningCountry(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select country</option>
                <option value="AU">Australia</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CN">China</option>
                <option value="RU">Russia</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={handleScreen}
              disabled={!screeningName || screening}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {screening ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Search className="w-5 h-5 mr-2" />
              )}
              {screening ? 'Screening...' : 'Screen for PEP Status'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Screenings</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">PEPs Identified</p>
                <p className="mt-2 text-3xl font-semibold text-orange-600">{stats.peps}</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">PEP Rate</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.pepRate}%</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3">
                <User className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Screening History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>PEP Screening History</CardTitle>
            <button
              onClick={fetchScreeningHistory}
              disabled={loading}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          )}

          {!loading && screeningHistory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No screenings yet. Use the form above to screen a name.</p>
            </div>
          )}

          {!loading && screeningHistory.length > 0 && (
            <div className="space-y-4">
              {screeningHistory.map((pepScreening) => {
                const badge = getResultBadge(pepScreening.isPep);
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={pepScreening.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      pepScreening.isPep
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-base font-semibold text-gray-900">
                            {pepScreening.name}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}
                          >
                            <BadgeIcon className="w-3 h-3 mr-1" />
                            {badge.text}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Country:</span> {pepScreening.country}
                          </div>
                          <div>
                            <span className="font-medium">Screened:</span>{' '}
                            {new Date(pepScreening.screenedAt).toLocaleDateString()}
                          </div>
                        </div>

                        {pepScreening.matchDetails && pepScreening.isPep && (
                          <div className="mt-4 bg-orange-100 border border-orange-300 rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-orange-900 mb-3">
                              PEP Details - Enhanced Due Diligence Required
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {pepScreening.matchDetails.position && (
                                <div>
                                  <span className="font-medium text-orange-900">Position:</span>{' '}
                                  <span className="text-orange-800">
                                    {pepScreening.matchDetails.position}
                                  </span>
                                </div>
                              )}
                              {pepScreening.matchDetails.category && (
                                <div>
                                  <span className="font-medium text-orange-900">Category:</span>{' '}
                                  <span className="text-orange-800 capitalize">
                                    {pepScreening.matchDetails.category.replace('_', ' ')}
                                  </span>
                                </div>
                              )}
                              {pepScreening.matchDetails.country && (
                                <div>
                                  <span className="font-medium text-orange-900">Jurisdiction:</span>{' '}
                                  <span className="text-orange-800">
                                    {pepScreening.matchDetails.country}
                                  </span>
                                </div>
                              )}
                              {pepScreening.matchDetails.riskLevel && (
                                <div>
                                  <span className="font-medium text-orange-900">Risk Level:</span>{' '}
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskBadge(pepScreening.matchDetails.riskLevel)}`}
                                  >
                                    {pepScreening.matchDetails.riskLevel}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 bg-orange-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-orange-900">
                                AUSTRAC Requirements
                              </p>
                              <p className="text-xs text-orange-800 mt-1">
                                Enhanced Customer Due Diligence (ECDD) must be performed for this
                                individual. This includes obtaining additional information about the
                                source of wealth, source of funds, and conducting ongoing monitoring of
                                the business relationship.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
