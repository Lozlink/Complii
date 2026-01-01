'use client';

import { useState } from 'react';
import { Search, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function SanctionsPage() {
  const [screeningName, setScreeningName] = useState('');
  const [screeningDOB, setScreeningDOB] = useState('');
  const [screeningCountry, setScreeningCountry] = useState('');

  const handleScreen = () => {
    // In real implementation, call API to screen
    console.log('Screening:', { name: screeningName, dob: screeningDOB, country: screeningCountry });
    alert(`Screening "${screeningName}" against sanctions lists...`);
  };

  // Mock screening history
  const screeningHistory = [
    {
      id: 'scr_1',
      name: 'John Smith',
      dateOfBirth: '1985-06-15',
      country: 'Australia',
      result: 'no_match',
      matchCount: 0,
      screenedAt: '2025-12-20T10:30:00Z',
      lists: ['DFAT', 'UN'],
    },
    {
      id: 'scr_2',
      name: 'Vladimir Petrov',
      dateOfBirth: '1970-03-22',
      country: 'Russia',
      result: 'match',
      matchCount: 2,
      matchDetails: [
        {
          list: 'DFAT',
          name: 'Vladimir PETROV',
          aliases: ['V. Petrov'],
          sanctionType: 'Financial',
          country: 'Russia',
        },
      ],
      screenedAt: '2025-12-21T14:15:00Z',
      lists: ['DFAT', 'UN'],
    },
    {
      id: 'scr_3',
      name: 'Sarah Johnson',
      dateOfBirth: '1992-11-08',
      country: 'United States',
      result: 'no_match',
      matchCount: 0,
      screenedAt: '2025-12-22T09:45:00Z',
      lists: ['DFAT', 'UN'],
    },
  ];

  const getResultBadge = (result: string, matchCount: number) => {
    if (result === 'match' || matchCount > 0) {
      return {
        class: 'bg-red-100 text-red-800',
        icon: AlertTriangle,
        text: `${matchCount} Match${matchCount !== 1 ? 'es' : ''}`,
      };
    }
    return {
      class: 'bg-green-100 text-green-800',
      icon: CheckCircle,
      text: 'No Match',
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
                <option value="RU">Russia</option>
                <option value="CN">China</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={handleScreen}
              disabled={!screeningName}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5 mr-2" />
              Screen Now
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
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {screeningHistory.length}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-red-600">
                  {screeningHistory.reduce((sum, s) => sum + s.matchCount, 0)}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-green-600">
                  {screeningHistory.filter((s) => s.result === 'no_match').length}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {((screeningHistory.filter((s) => s.result === 'match').length /
                    screeningHistory.length) *
                    100).toFixed(1)}%
                </p>
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
          <CardTitle>Screening History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {screeningHistory.map((screening) => {
              const badge = getResultBadge(screening.result, screening.matchCount);
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
                          <badge.icon className="w-3 h-3 mr-1" />
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
                          <span className="font-medium">Country:</span> {screening.country}
                        </div>
                        <div>
                          <span className="font-medium">Screened:</span>{' '}
                          {new Date(screening.screenedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Lists checked:</span>{' '}
                        {screening.lists.join(', ')}
                      </div>

                      {screening.matchDetails && screening.matchDetails.length > 0 && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-red-900 mb-3">
                            Match Details
                          </h5>
                          {screening.matchDetails.map((match, idx) => (
                            <div key={idx} className="mb-3 last:mb-0">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="font-medium text-red-900">List:</span>{' '}
                                  <span className="text-red-800">{match.list}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-red-900">Name:</span>{' '}
                                  <span className="text-red-800">{match.name}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-red-900">Type:</span>{' '}
                                  <span className="text-red-800">{match.sanctionType}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-red-900">Country:</span>{' '}
                                  <span className="text-red-800">{match.country}</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
