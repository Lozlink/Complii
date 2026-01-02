'use client';

import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface MatchDetails {
  position: string;
  category: string;
  jurisdiction: string;
  riskLevel: string;
  associatedPersons: string[];
}

interface PepScreening {
  id: string;
  name: string;
  country: string;
  result: string;
  isPep: boolean;
  matchDetails?: MatchDetails;
  screenedAt: string;
}
export default function PepPage() {
  const [screeningName, setScreeningName] = useState('');
  const [screeningCountry, setScreeningCountry] = useState('');

  const handleScreen = () => {
    // In real implementation, call API to screen
    console.log('PEP Screening:', { name: screeningName, country: screeningCountry });
    alert(`Screening "${screeningName}" for PEP status...`);
  };

  // Mock screening history
  const screeningHistory: PepScreening[] = [
    {
      id: 'pep_1',
      name: 'John Smith',
      country: 'Australia',
      result: 'no_match',
      isPep: false,
      screenedAt: '2025-12-20T10:30:00Z',
    },
    {
      id: 'pep_2',
      name: 'Alexander Morrison',
      country: 'Australia',
      result: 'match',
      isPep: true,
      matchDetails: {
        position: 'Minister of Trade',
        category: 'government_official',
        jurisdiction: 'Australia',
        riskLevel: 'high',
        associatedPersons: ['Jane Morrison (Spouse)'],
      },
      screenedAt: '2025-12-21T14:15:00Z',
    },
    {
      id: 'pep_3',
      name: 'Emma Williams',
      country: 'United Kingdom',
      result: 'no_match',
      isPep: false,
      screenedAt: '2025-12-22T09:45:00Z',
    },
  ];

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
    const badges = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return (badges as any)[risk] || badges.low;
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
              disabled={!screeningName}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5 mr-2" />
              Screen for PEP Status
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
                <p className="text-sm font-medium text-gray-600">PEPs Identified</p>
                <p className="mt-2 text-3xl font-semibold text-orange-600">
                  {screeningHistory.filter((s) => s.isPep).length}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {((screeningHistory.filter((s) => s.isPep).length / screeningHistory.length) *
                    100).toFixed(1)}%
                </p>
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
          <CardTitle>PEP Screening History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {screeningHistory.map((screening) => {
              const badge = getResultBadge(screening.isPep);
              return (
                <div
                  key={screening.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    screening.isPep
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
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
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Country:</span> {screening.country}
                        </div>
                        <div>
                          <span className="font-medium">Screened:</span>{' '}
                          {new Date(screening.screenedAt).toLocaleDateString()}
                        </div>
                      </div>

                      {screening?.matchDetails && (
                        <div className="mt-4 bg-orange-100 border border-orange-300 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-orange-900 mb-3">
                            PEP Details - Enhanced Due Diligence Required
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="font-medium text-orange-900">Position:</span>{' '}
                              <span className="text-orange-800">
                                {screening.matchDetails.position}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-orange-900">Category:</span>{' '}
                              <span className="text-orange-800 capitalize">
                                {screening.matchDetails.category.replace('_', ' ')}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-orange-900">Jurisdiction:</span>{' '}
                              <span className="text-orange-800">
                                {screening.matchDetails.jurisdiction}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-orange-900">Risk Level:</span>{' '}
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskBadge(screening.matchDetails.riskLevel)}`}
                              >
                                {screening.matchDetails.riskLevel}
                              </span>
                            </div>
                          </div>
                          {screening.matchDetails.associatedPersons &&
                            screening.matchDetails.associatedPersons.length > 0 && (
                              <div className="mt-3 text-sm">
                                <span className="font-medium text-orange-900">
                                  Associated Persons:
                                </span>{' '}
                                <span className="text-orange-800">
                                  {screening.matchDetails.associatedPersons.join(', ')}
                                </span>
                              </div>
                            )}
                          <div className="mt-4 bg-orange-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-orange-900">
                              ⚠️ AUSTRAC Requirements
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
        </CardContent>
      </Card>
    </div>
  );
}
