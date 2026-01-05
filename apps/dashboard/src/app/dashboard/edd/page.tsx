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
  FileSearch,
  User,
  Plus,
  ArrowUpRight,
  XCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';

interface EDDInvestigation {
  id: string;
  investigationNumber: string;
  customerId: string;
  transactionId?: string;
  status: string;
  triggerReason: string;
  triggeredBy: string;
  assignedTo?: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    riskLevel?: string;
    isPep?: boolean;
  };
  transaction?: {
    id: string;
    amount: number;
    currency: string;
    date: string;
  };
  complianceRecommendation?: string;
  openedAt: string;
  completedAt?: string;
  createdAt: string;
}

export default function EDDPage() {
  const [investigations, setInvestigations] = useState<EDDInvestigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(`/api/proxy/edd?${params.toString()}`);
      if (!response.ok) throw new Error('API unavailable');

      const data = await response.json();
      setInvestigations(data.data || []);
    } catch {
      setError('Failed to load EDD investigations. Please try again.');
      setInvestigations([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchInvestigations();
  }, [fetchInvestigations]);

  const filteredInvestigations = investigations.filter((inv) => {
    const matchesSearch =
      inv.investigationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.triggerReason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: investigations.length,
    open: investigations.filter((i) => i.status === 'open').length,
    awaitingInfo: investigations.filter((i) => i.status === 'awaiting_customer_info').length,
    escalated: investigations.filter((i) => i.status === 'escalated').length,
    completed: investigations.filter((i) => i.status.startsWith('completed')).length,
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      open: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: <FileSearch className="w-3 h-3" />,
      },
      awaiting_customer_info: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: <Clock className="w-3 h-3" />,
      },
      under_review: {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        icon: <FileSearch className="w-3 h-3" />,
      },
      escalated: {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        icon: <ArrowUpRight className="w-3 h-3" />,
      },
      completed_approved: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      completed_rejected: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: <XCircle className="w-3 h-3" />,
      },
      completed_ongoing_monitoring: {
        bg: 'bg-teal-100',
        text: 'text-teal-800',
        icon: <Clock className="w-3 h-3" />,
      },
    };
    return badges[status] || badges.open;
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .replace('completed ', '')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const getRiskBadge = (level?: string) => {
    if (!level) return null;
    const badges: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[level] || badges.low;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">EDD Investigations</h1>
          <p className="mt-2 text-gray-600">Enhanced Due Diligence case management</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Investigation
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Total"
          value={stats.total}
          icon={FileSearch}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Open"
          value={stats.open}
          change="Active investigations"
          changeType={stats.open > 0 ? 'neutral' : 'positive'}
          icon={AlertCircle}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Awaiting Info"
          value={stats.awaitingInfo}
          icon={Clock}
          iconColor="bg-yellow-500"
        />
        <StatCard
          title="Escalated"
          value={stats.escalated}
          change="Needs management"
          changeType={stats.escalated > 0 ? 'negative' : 'neutral'}
          icon={ArrowUpRight}
          iconColor="bg-orange-500"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle}
          iconColor="bg-green-500"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Investigations</CardTitle>
            <button
              onClick={fetchInvestigations}
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

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search investigations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active (Open/Review/Escalated)</option>
                <option value="open">Open</option>
                <option value="awaiting_customer_info">Awaiting Customer Info</option>
                <option value="under_review">Under Review</option>
                <option value="escalated">Escalated</option>
                <option value="completed_approved">Completed - Approved</option>
                <option value="completed_rejected">Completed - Rejected</option>
                <option value="completed_ongoing_monitoring">Completed - Monitoring</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading investigations...</span>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Investigation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trigger Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opened
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvestigations.map((inv) => {
                    const statusStyle = getStatusBadge(inv.status);
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {inv.investigationNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            Triggered by: {inv.triggeredBy}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {inv.customer?.name || 'Unknown'}
                              </div>
                              <div className="flex items-center space-x-2">
                                {inv.customer?.riskLevel && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getRiskBadge(
                                      inv.customer.riskLevel
                                    )}`}
                                  >
                                    {inv.customer.riskLevel}
                                  </span>
                                )}
                                {inv.customer?.isPep && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                    PEP
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {inv.triggerReason}
                          </div>
                          {inv.transaction && (
                            <div className="text-xs text-gray-500">
                              {inv.transaction.currency} $
                              {inv.transaction.amount.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            {statusStyle.icon}
                            <span className="ml-1">{formatStatus(inv.status)}</span>
                          </span>
                          {inv.complianceRecommendation && (
                            <div className="mt-1 text-xs text-gray-500">
                              {inv.complianceRecommendation.replace(/_/g, ' ')}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimeAgo(inv.openedAt)}
                          {inv.completedAt && (
                            <div className="text-xs text-green-600">
                              Completed {formatTimeAgo(inv.completedAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/dashboard/edd/${inv.id}`}
                            className="text-primary hover:text-primary/80 font-medium"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredInvestigations.length === 0 && (
            <div className="text-center py-12">
              <FileSearch className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No EDD investigations found</p>
              <p className="text-sm text-gray-400 mt-1">
                {filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a new investigation to get started'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal - Simplified for now */}
      {showCreateModal && (
        <CreateEDDModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchInvestigations();
          }}
        />
      )}
    </div>
  );
}

function CreateEDDModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [triggerReason, setTriggerReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !triggerReason) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/proxy/edd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          customerId,
          triggerReason,
          triggeredBy: 'admin',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create investigation');
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create investigation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Create EDD Investigation
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer ID
            </label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Enter customer ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trigger Reason
            </label>
            <textarea
              value={triggerReason}
              onChange={(e) => setTriggerReason(e.target.value)}
              placeholder="Why is EDD required for this customer?"
              className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !customerId || !triggerReason}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

