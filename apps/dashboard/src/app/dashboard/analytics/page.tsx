'use client';

import { Users, ArrowRightLeft, Shield, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AnalyticsPage() {
  // Mock analytics data
  const analytics = {
    customers: {
      total: 1247,
      verified: 1156,
      sanctioned: 3,
      pep: 12,
      verificationRate: 92.7,
      newThisMonth: 127,
      growthRate: 11.3,
    },
    transactions: {
      total: 8934,
      totalAmount: 12456789,
      averageAmount: 1394,
      ttrRequired: 234,
      flaggedForReview: 45,
      monthlyGrowth: 8.5,
    },
    screenings: {
      total: 1589,
      sanctions: 1302,
      pep: 287,
      matches: 18,
      matchRate: 1.1,
    },
    compliance: {
      kycCompliance: 92.7,
      screeningCoverage: 100,
      ttrSubmitted: 189,
      ttrPending: 45,
    },
  };

  const monthlyData = [
    { month: 'Jul', customers: 95, transactions: 723, amount: 980000 },
    { month: 'Aug', customers: 108, transactions: 801, amount: 1056000 },
    { month: 'Sep', customers: 115, transactions: 856, amount: 1123000 },
    { month: 'Oct', customers: 119, transactions: 892, amount: 1201000 },
    { month: 'Nov', customers: 124, transactions: 934, amount: 1167000 },
    { month: 'Dec', customers: 127, transactions: 1012, amount: 1287000 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-2 text-gray-600">Comprehensive compliance and business metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Customers"
          value={analytics.customers.total.toLocaleString()}
          change={`+${analytics.customers.growthRate}% this month`}
          changeType="positive"
          icon={Users}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Transaction Volume"
          value={`$${(analytics.transactions.totalAmount / 1000000).toFixed(1)}M`}
          change={`+${analytics.transactions.monthlyGrowth}% from last month`}
          changeType="positive"
          icon={ArrowRightLeft}
          iconColor="bg-green-500"
        />
        <StatCard
          title="Screening Matches"
          value={analytics.screenings.matches}
          change={`${analytics.screenings.matchRate}% match rate`}
          changeType="neutral"
          icon={Shield}
          iconColor="bg-red-500"
        />
        <StatCard
          title="KYC Compliance"
          value={`${analytics.customers.verificationRate}%`}
          change="Within regulatory requirements"
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-purple-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Customer Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((data, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{data.month}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {data.customers} customers
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(data.customers / Math.max(...monthlyData.map((d) => d.customers))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((data, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{data.month}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${(data.amount / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(data.amount / Math.max(...monthlyData.map((d) => d.amount))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">KYC Compliance Rate</p>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-2xl font-semibold text-gray-900">
                      {analytics.compliance.kycCompliance}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-3 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${analytics.compliance.kycCompliance}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">Screening Coverage</p>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-2xl font-semibold text-gray-900">
                      {analytics.compliance.screeningCoverage}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-3 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${analytics.compliance.screeningCoverage}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">TTR Submitted</p>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-2xl font-semibold text-gray-900">
                      {analytics.compliance.ttrSubmitted}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Reports this quarter</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">TTR Pending</p>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-2xl font-semibold text-orange-600">
                      {analytics.compliance.ttrPending}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Awaiting submission</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Low Risk</span>
                  <span className="text-sm font-semibold text-gray-900">1,180 (94.6%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: '94.6%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Medium Risk</span>
                  <span className="text-sm font-semibold text-gray-900">54 (4.3%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-orange-500 h-3 rounded-full" style={{ width: '4.3%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">High Risk</span>
                  <span className="text-sm font-semibold text-gray-900">13 (1.1%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-red-500 h-3 rounded-full" style={{ width: '1.1%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Screening Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Sanctions Screenings</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.screenings.sanctions}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Matches: 15</span>
                  <span>Match rate: 1.2%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">PEP Screenings</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.screenings.pep}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Matches: 3</span>
                  <span>Match rate: 1.0%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Total Matches</span>
                  <span className="text-sm font-semibold text-red-600">
                    {analytics.screenings.matches}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Overall rate: {analytics.screenings.matchRate}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
