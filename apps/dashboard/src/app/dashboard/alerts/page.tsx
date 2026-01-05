'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Bell,
  ArrowUpRight,
  User,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';

interface Alert {
  id: string;
  alertNumber: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';
  entityType: string;
  entityId: string;
  customerId?: string;
  customerName?: string;
  triggerData?: Record<string, unknown>;
  isEscalated: boolean;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);

      const response = await fetch(`/api/proxy/alerts?${params.toString()}`);
      if (!response.ok) throw new Error('API unavailable');

      const data = await response.json();
      setAlerts(data.data || []);
    } catch {
      setError('Failed to load alerts. Please try again.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.alertNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alert.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: alerts.length,
    open: alerts.filter((a) => a.status === 'open').length,
    critical: alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length,
    escalated: alerts.filter((a) => a.isEscalated && a.status !== 'resolved').length,
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return badges[severity] || badges.low;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      open: 'bg-red-50 text-red-700',
      acknowledged: 'bg-blue-50 text-blue-700',
      investigating: 'bg-purple-50 text-purple-700',
      resolved: 'bg-green-50 text-green-700',
      dismissed: 'bg-gray-50 text-gray-700',
    };
    return badges[status] || badges.open;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'investigating':
        return <Clock className="w-4 h-4 text-purple-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const handleBulkAction = async (action: 'acknowledge' | 'resolve' | 'dismiss') => {
    if (selectedAlerts.length === 0) return;

    try {
      await Promise.all(
        selectedAlerts.map((id) =>
          fetch(`/api/proxy/alerts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          })
        )
      );
      setSelectedAlerts([]);
      fetchAlerts();
    } catch {
      setError('Failed to update alerts');
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

  const toggleSelectAll = () => {
    if (selectedAlerts.length === filteredAlerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(filteredAlerts.map((a) => a.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="mt-2 text-gray-600">Monitor and manage compliance alerts</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Alerts"
          value={stats.total}
          icon={Bell}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Open Alerts"
          value={stats.open}
          change="Requires attention"
          changeType={stats.open > 0 ? 'negative' : 'positive'}
          icon={AlertCircle}
          iconColor="bg-orange-500"
        />
        <StatCard
          title="Critical"
          value={stats.critical}
          change="High priority"
          changeType={stats.critical > 0 ? 'negative' : 'positive'}
          icon={AlertTriangle}
          iconColor="bg-red-500"
        />
        <StatCard
          title="Escalated"
          value={stats.escalated}
          change="Management review"
          changeType={stats.escalated > 0 ? 'negative' : 'neutral'}
          icon={ArrowUpRight}
          iconColor="bg-purple-500"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Alerts</CardTitle>
            <div className="flex items-center space-x-2">
              {selectedAlerts.length > 0 && (
                <div className="flex items-center space-x-2 mr-4">
                  <span className="text-sm text-gray-600">
                    {selectedAlerts.length} selected
                  </span>
                  <button
                    onClick={() => handleBulkAction('acknowledge')}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleBulkAction('resolve')}
                    className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleBulkAction('dismiss')}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <button
                onClick={fetchAlerts}
                disabled={loading}
                className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading alerts...</span>
            </div>
          )}

          {/* Alerts List */}
          {!loading && (
            <div className="space-y-3">
              {/* Select All */}
              {filteredAlerts.length > 0 && (
                <div className="flex items-center px-4 py-2 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedAlerts.length === filteredAlerts.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-sm text-gray-600">
                    Select all ({filteredAlerts.length})
                  </span>
                </div>
              )}

              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow ${
                    alert.severity === 'critical'
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAlerts.includes(alert.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAlerts([...selectedAlerts, alert.id]);
                      } else {
                        setSelectedAlerts(selectedAlerts.filter((id) => id !== alert.id));
                      }
                    }}
                    className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />

                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/dashboard/alerts/${alert.id}`}
                            className="text-sm font-semibold text-gray-900 hover:text-primary"
                          >
                            {alert.title}
                          </Link>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getSeverityBadge(
                              alert.severity
                            )}`}
                          >
                            {alert.severity}
                          </span>
                          {alert.isEscalated && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                              Escalated
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <FileText className="w-3 h-3 mr-1" />
                            {alert.alertNumber}
                          </span>
                          {alert.customerName && (
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              {alert.customerName}
                            </span>
                          )}
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTimeAgo(alert.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            alert.status
                          )}`}
                        >
                          {getStatusIcon(alert.status)}
                          <span className="ml-1 capitalize">{alert.status}</span>
                        </span>
                        <Link
                          href={`/dashboard/alerts/${alert.id}`}
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="text-gray-500">No alerts found</p>
              <p className="text-sm text-gray-400 mt-1">
                {filterStatus !== 'all' || filterSeverity !== 'all'
                  ? 'Try adjusting your filters'
                  : 'All clear!'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

