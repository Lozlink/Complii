'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowRightLeft,
  Shield,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Clock,
  FileText,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Analytics {
  customers: {
    total: number;
    verified: number;
    pending: number;
    sanctioned: number;
    pep: number;
    business: number;
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
  alerts: {
    open: number;
    critical: number;
  };
  cases: {
    open: number;
    pending: number;
  };
  ocdd: {
    dueThisWeek: number;
    overdue: number;
  };
}

interface Alert {
  id: string;
  type: 'sanctions' | 'pep' | 'transaction' | 'ocdd' | 'case';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  customerId?: string;
  transactionId?: string;
  createdAt: string;
}

// Fallback mock data
const mockAnalytics: Analytics = {
  customers: {
    total: 1247,
    verified: 1156,
    pending: 78,
    sanctioned: 3,
    pep: 12,
    business: 89,
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
  alerts: {
    open: 23,
    critical: 5,
  },
  cases: {
    open: 8,
    pending: 3,
  },
  ocdd: {
    dueThisWeek: 12,
    overdue: 4,
  },
};

const mockAlerts: Alert[] = [
  {
    id: 'alert_1',
    type: 'sanctions',
    severity: 'critical',
    title: 'Sanctions Match Detected',
    description: 'Potential match found on DFAT consolidated list',
    customerId: 'cus_789',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert_2',
    type: 'pep',
    severity: 'high',
    title: 'PEP Identified',
    description: 'Enhanced due diligence required for politically exposed person',
    customerId: 'cus_456',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert_3',
    type: 'transaction',
    severity: 'medium',
    title: 'Large Transaction - TTR Required',
    description: 'Transaction exceeds $10,000 threshold',
    transactionId: 'txn_123',
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert_4',
    type: 'ocdd',
    severity: 'medium',
    title: 'OCDD Review Due',
    description: 'Customer due for ongoing due diligence review',
    customerId: 'cus_234',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics>(mockAnalytics);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [region, setRegion] = useState('AU');
  const [regulator, setRegulator] = useState('AUSTRAC');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch analytics from multiple endpoints in parallel
      const [customersRes, transactionsRes, alertsRes, configRes] = await Promise.all([
        fetch('/api/proxy/customers?limit=1'),
        fetch('/api/proxy/transactions?limit=1'),
        fetch('/api/proxy/alerts?status=open&limit=10'),
        fetch('/api/proxy/config/regions'),
      ]);

      let hasRealData = false;

      // Parse customer analytics
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        if (customersData.pagination?.total !== undefined) {
          setAnalytics((prev) => ({
            ...prev,
            customers: {
              ...prev.customers,
              total: customersData.pagination.total,
            },
          }));
          hasRealData = true;
        }
      }

      // Parse transaction analytics
      if (transactionsRes.ok) {
        const txData = await transactionsRes.json();
        if (txData.pagination?.total !== undefined) {
          setAnalytics((prev) => ({
            ...prev,
            transactions: {
              ...prev.transactions,
              total: txData.pagination.total,
            },
          }));
          hasRealData = true;
        }
      }

      // Parse alerts
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        if (alertsData.data && alertsData.data.length > 0) {
          // Transform API alerts to our format
          const transformedAlerts = alertsData.data.map((a: Record<string, unknown>) => ({
            id: a.id,
            type: a.alert_type || 'transaction',
            severity: a.severity || 'medium',
            title: a.title || 'Alert',
            description: a.description || '',
            customerId: a.customer_id,
            transactionId: a.transaction_id,
            createdAt: a.created_at,
          }));
          setAlerts(transformedAlerts);
          hasRealData = true;
        }
      }

      // Parse config for region
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.current_region) {
          setRegion(configData.current_region);
        }
        if (configData.current_config?.regulator) {
          setRegulator(configData.current_config.regulator);
        }
      }

      setUsingMockData(!hasRealData);
    } catch {
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getAlertStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'high':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'sanctions':
        return <Shield className="w-5 h-5 text-red-600" />;
      case 'pep':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'transaction':
        return <ArrowRightLeft className="w-5 h-5 text-yellow-600" />;
      case 'ocdd':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">{regulator} Compliance Overview ({region})</p>
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

      {usingMockData && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          Showing demo data. Connect to the API for live analytics.
        </div>
      )}

      {/* Primary Stats Grid */}
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
          title="Open Alerts"
          value={analytics.alerts.open}
          change={`${analytics.alerts.critical} critical`}
          changeType={analytics.alerts.critical > 0 ? 'negative' : 'neutral'}
          icon={AlertTriangle}
          iconColor="bg-orange-500"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Business Customers</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.customers.business}</p>
            </div>
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Open Cases</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.cases.open}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">OCDD Due This Week</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.ocdd.dueThisWeek}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Transaction</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analytics.transactions.averageAmount.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Risk Distribution & Alerts */}
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
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
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
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-orange-500 h-3 rounded-full transition-all duration-500"
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
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${(analytics.riskDistribution.high / analytics.customers.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* PEP & Sanctions Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{analytics.customers.pep}</p>
                    <p className="text-xs text-gray-500">PEP Identified</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Shield className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {analytics.customers.sanctioned}
                    </p>
                    <p className="text-xs text-gray-500">Sanctions Matches</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Alerts</CardTitle>
              <Link
                href="/dashboard/alerts"
                className="text-sm text-primary hover:text-primary/80"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border ${getAlertStyle(alert.severity)}`}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs mt-0.5 opacity-80">{alert.description}</p>
                    <p className="text-xs mt-1 opacity-60">{formatTimeAgo(alert.createdAt)}</p>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                  <p>No open alerts</p>
                </div>
              )}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
                  analytics.customers.verificationRate >= 90 ? 'bg-green-100' : 'bg-orange-100'
                }`}
              >
                {analytics.customers.verificationRate >= 90 ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">KYC Compliance</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.customers.verificationRate}% verified
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">Sanctions Screening</p>
              <p className="text-xs text-gray-500 mt-1">All customers screened</p>
            </div>
            <div className="text-center">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
                  analytics.transactions.ttrRequired > 0 ? 'bg-orange-100' : 'bg-green-100'
                }`}
              >
                {analytics.transactions.ttrRequired > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">TTR Reports</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.transactions.ttrRequired} pending submission
              </p>
            </div>
            <div className="text-center">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
                  analytics.ocdd.overdue > 0 ? 'bg-red-100' : 'bg-green-100'
                }`}
              >
                {analytics.ocdd.overdue > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">OCDD Reviews</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.ocdd.overdue > 0
                  ? `${analytics.ocdd.overdue} overdue`
                  : 'All up to date'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/dashboard/customers/new"
          className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Users className="w-5 h-5 mr-2 text-primary" />
          <span className="font-medium text-gray-900">Add Customer</span>
        </Link>
        <Link
          href="/dashboard/transactions"
          className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <ArrowRightLeft className="w-5 h-5 mr-2 text-primary" />
          <span className="font-medium text-gray-900">View Transactions</span>
        </Link>
        <Link
          href="/dashboard/sanctions"
          className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Shield className="w-5 h-5 mr-2 text-primary" />
          <span className="font-medium text-gray-900">Screen Customer</span>
        </Link>
        <Link
          href="/dashboard/reports"
          className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <FileText className="w-5 h-5 mr-2 text-primary" />
          <span className="font-medium text-gray-900">Generate Report</span>
        </Link>
      </div>
    </div>
  );
}
