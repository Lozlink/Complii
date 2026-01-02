'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, ArrowRightLeft, Shield, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface AnalyticsData {
  object: string;
  period: {
    start: string;
    end: string;
  };
  customers: {
    total: number;
    verified: number;
    sanctioned: number;
    pep: number;
    verificationRate: number;
  };
  transactions: {
    total: number;
    totalAmount: number;
    averageAmount: number;
    ttrRequired: number;
    flaggedForReview: number;
  };
  screenings: {
    total: number;
    matches: number;
    matchRate: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/analytics/overview');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setAnalytics(data);
    } catch {
      setError('Failed to load analytics. Please try again.');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Calculate percentages for risk distribution
  const totalCustomers = analytics?.riskDistribution
    ? analytics.riskDistribution.low + analytics.riskDistribution.medium + analytics.riskDistribution.high
    : 0;

  const getRiskPercentage = (count: number) => {
    if (totalCustomers === 0) return 0;
    return ((count / totalCustomers) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">Comprehensive compliance and business metrics</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="mt-3 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">Comprehensive compliance and business metrics</p>
        </div>
        <div className="text-center py-12 text-gray-500">
          No analytics data available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">Comprehensive compliance and business metrics</p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="flex items-center px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Customers"
          value={analytics.customers.total.toLocaleString()}
          change={`${analytics.customers.verified.toLocaleString()} verified`}
          changeType="neutral"
          icon={Users}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Transaction Volume"
          value={`$${(analytics.transactions.totalAmount / 1000000).toFixed(1)}M`}
          change={`${analytics.transactions.total.toLocaleString()} transactions`}
          changeType="neutral"
          icon={ArrowRightLeft}
          iconColor="bg-green-500"
        />
        <StatCard
          title="Screening Matches"
          value={analytics.screenings.matches}
          change={`${analytics.screenings.matchRate.toFixed(1)}% match rate`}
          changeType="neutral"
          icon={Shield}
          iconColor="bg-red-500"
        />
        <StatCard
          title="KYC Compliance"
          value={`${analytics.customers.verificationRate.toFixed(1)}%`}
          change="Verification rate"
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-purple-500"
        />
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
                      {analytics.customers.verificationRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-3 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${Math.min(analytics.customers.verificationRate, 100)}%` }}
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
                      {analytics.screenings.total}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Total screenings performed</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">TTR Required</p>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-2xl font-semibold text-gray-900">
                      {analytics.transactions.ttrRequired}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Transactions requiring TTR</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">Flagged for Review</p>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-2xl font-semibold text-orange-600">
                      {analytics.transactions.flaggedForReview}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Transactions flagged</p>
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
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.riskDistribution.low.toLocaleString()} ({getRiskPercentage(analytics.riskDistribution.low)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{ width: `${getRiskPercentage(analytics.riskDistribution.low)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Medium Risk</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.riskDistribution.medium.toLocaleString()} ({getRiskPercentage(analytics.riskDistribution.medium)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-orange-500 h-3 rounded-full"
                    style={{ width: `${getRiskPercentage(analytics.riskDistribution.medium)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">High Risk</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.riskDistribution.high.toLocaleString()} ({getRiskPercentage(analytics.riskDistribution.high)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full"
                    style={{ width: `${getRiskPercentage(analytics.riskDistribution.high)}%` }}
                  />
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
                  <span className="text-sm font-medium text-gray-700">Total Screenings</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.screenings.total.toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Matches Found</span>
                  <span className="text-sm font-semibold text-red-600">
                    {analytics.screenings.matches}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Match rate: {analytics.screenings.matchRate.toFixed(2)}%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Sanctioned Customers</span>
                  <span className="text-sm font-semibold text-red-600">
                    {analytics.customers.sanctioned}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">PEP Customers</span>
                  <span className="text-sm font-semibold text-orange-600">
                    {analytics.customers.pep}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-600">Total Transactions</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {analytics.transactions.total.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-600">Total Volume</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                ${analytics.transactions.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-600">Average Transaction</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                ${analytics.transactions.averageAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
