import { Users, ArrowRightLeft, Shield, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function DashboardPage() {
  // In a real implementation, fetch analytics data from API
  const analytics = {
    customers: {
      total: 1247,
      verified: 1156,
      sanctioned: 3,
      pep: 12,
      verificationRate: 92.7,
    },
    transactions: {
      total: 8934,
      totalAmount: 12456789,
      averageAmount: 1394,
      ttrRequired: 234,
      flaggedForReview: 45,
    },
    screenings: {
      total: 1589,
      matches: 18,
      matchRate: 1.1,
    },
    riskDistribution: {
      low: 1180,
      medium: 54,
      high: 13,
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          AUSTRAC Compliance Overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Customers"
          value={analytics.customers.total.toLocaleString()}
          change={`${analytics.customers.verificationRate}% verified`}
          changeType="positive"
          icon={Users}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Transactions"
          value={analytics.transactions.total.toLocaleString()}
          change={`${analytics.transactions.ttrRequired} require TTR`}
          changeType="neutral"
          icon={ArrowRightLeft}
          iconColor="bg-green-500"
        />
        <StatCard
          title="Sanctions Matches"
          value={analytics.screenings.matches}
          change={`${analytics.screenings.matchRate}% match rate`}
          changeType="negative"
          icon={Shield}
          iconColor="bg-red-500"
        />
        <StatCard
          title="Flagged Reviews"
          value={analytics.transactions.flaggedForReview}
          change="Requires attention"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="bg-orange-500"
        />
      </div>

      {/* Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Low Risk</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.riskDistribution.low}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${(analytics.riskDistribution.low / analytics.customers.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Medium Risk</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.riskDistribution.medium}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{
                      width: `${(analytics.riskDistribution.medium / analytics.customers.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">High Risk</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.riskDistribution.high}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${(analytics.riskDistribution.high / analytics.customers.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Sanctions Match Detected</p>
                  <p className="text-xs text-red-700 mt-1">Customer ID: CUS_789 - High risk</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900">PEP Identified</p>
                  <p className="text-xs text-orange-700 mt-1">Customer ID: CUS_456 - Enhanced due diligence required</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">Large Transaction</p>
                  <p className="text-xs text-yellow-700 mt-1">Transaction ID: TXN_123 - AUD $15,000 - TTR required</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">KYC Compliance</p>
              <p className="text-xs text-gray-500 mt-1">{analytics.customers.verificationRate}% verified</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">Sanctions Screening</p>
              <p className="text-xs text-gray-500 mt-1">All customers screened</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">TTR Reports</p>
              <p className="text-xs text-gray-500 mt-1">{analytics.transactions.ttrRequired} pending submission</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
