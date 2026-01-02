'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Shield, AlertTriangle, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ScreeningResult {
  id: string;
  name: string;
  dateOfBirth?: string;
  country?: string;
  isMatch: boolean;
  matchScore: number;
  status: 'clear' | 'potential_match' | 'confirmed_match' | 'false_positive';
  matchedEntities?: Array<{
    name: string;
    source: string;
    matchScore: number;
    aliases?: string[];
  }>;
  screeningSources: string[];
  screenedAt: string;
}

export default function SanctionsPage() {
  const [screeningHistory, setScreeningHistory] = useState<ScreeningResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screening, setScreening] = useState(false);

  const [screeningName, setScreeningName] = useState('');
  const [screeningDOB, setScreeningDOB] = useState('');
  const [screeningCountry, setScreeningCountry] = useState('');

  const fetchScreeningHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/sanctions/history?limit=50');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();

      // Transform API response to match component format
      const history = (data.data || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.screenedName || `${s.screenedFirstName} ${s.screenedLastName}`.trim(),
        dateOfBirth: s.screenedDob,
        country: s.screenedCountry,
        isMatch: s.isMatch,
        matchScore: s.matchScore || 0,
        status: s.status || 'clear',
        matchedEntities: s.matchedEntities || [],
        screeningSources: s.screeningSources || ['DFAT'],
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
      const nameParts = screeningName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];

      const response = await fetch('/api/proxy/sanctions/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth: screeningDOB || undefined,
          country: screeningCountry || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Clear form
        setScreeningName('');
        setScreeningDOB('');
        setScreeningCountry('');

        // Refresh history from API
        await fetchScreeningHistory();

        if (result.isMatch) {
          alert(`Potential match found! Match score: ${result.matchScore}%`);
        } else {
          alert('No matches found');
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
    matches: screeningHistory.filter((s) => s.isMatch).length,
    clear: screeningHistory.filter((s) => !s.isMatch).length,
    matchRate: screeningHistory.length > 0
      ? ((screeningHistory.filter((s) => s.isMatch).length / screeningHistory.length) * 100).toFixed(1)
      : '0',
  };

  const getResultBadge = (result: ScreeningResult) => {
    if (result.isMatch || result.status === 'potential_match' || result.status === 'confirmed_match') {
      return {
        class: 'bg-red-100 text-red-800',
        icon: AlertTriangle,
        text: `Match (${result.matchScore}%)`,
      };
    }
    return {
      class: 'bg-green-100 text-green-800',
      icon: CheckCircle,
      text: 'Clear',
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sanctions Screening</h1>
        <p className="mt-2 text-gray-600">Screen individuals and entities against sanctions lists</p>
      </div>

      {/* Screening Form */}
      <Card>
        <CardHeader>
          <CardTitle>New Sanctions Screening</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-orange-900">Sanctions Lists</h4>
                <p className="text-sm text-orange-800 mt-1">
                  Screening is performed against DFAT Consolidated List and UN Security Council
                  sanctions lists. All customers must be screened before onboarding and
                  periodically thereafter.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                Date of Birth
              </label>
              <input
                type="date"
                value={screeningDOB}
                onChange={(e) => setScreeningDOB(e.target.value)}
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
                <option value="NZ">New Zealand</option>
                <option value="SG">Singapore</option>
                <option value="RU">Russia</option>
                <option value="CN">China</option>
                <option value="IR">Iran</option>
                <option value="KP">North Korea</option>
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
              {screening ? 'Screening...' : 'Screen Now'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                <p className="text-sm font-medium text-gray-600">Matches Found</p>
                <p className="mt-2 text-3xl font-semibold text-red-600">{stats.matches}</p>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Clear Results</p>
                <p className="mt-2 text-3xl font-semibold text-green-600">{stats.clear}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Match Rate</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.matchRate}%</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Screening History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Screening History</CardTitle>
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

          {!loading && (
            <div className="space-y-4">
              {screeningHistory.map((screening) => {
                const badge = getResultBadge(screening);
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={screening.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-base font-semibold text-gray-900">
                            {screening.name}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}
                          >
                            <BadgeIcon className="w-3 h-3 mr-1" />
                            {badge.text}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Date of Birth:</span>{' '}
                            {screening.dateOfBirth
                              ? new Date(screening.dateOfBirth).toLocaleDateString()
                              : 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Country:</span> {screening.country || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Screened:</span>{' '}
                            {new Date(screening.screenedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Lists checked:</span>{' '}
                          {screening.screeningSources.join(', ')}
                        </div>

                        {screening.matchedEntities && screening.matchedEntities.length > 0 && (
                          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-red-900 mb-3">
                              Match Details
                            </h5>
                            {screening.matchedEntities.map((match, idx) => (
                              <div key={idx} className="mb-3 last:mb-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="font-medium text-red-900">List:</span>{' '}
                                    <span className="text-red-800">{match.source}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-red-900">Name:</span>{' '}
                                    <span className="text-red-800">{match.name}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-red-900">Score:</span>{' '}
                                    <span className="text-red-800">{match.matchScore}%</span>
                                  </div>
                                </div>
                                {match.aliases && match.aliases.length > 0 && (
                                  <div className="mt-2 text-sm">
                                    <span className="font-medium text-red-900">Aliases:</span>{' '}
                                    <span className="text-red-800">{match.aliases.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && screeningHistory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No screenings yet. Use the form above to screen a name.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
