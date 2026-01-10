'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  ChevronRight,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface TTRTransaction {
  id: string;
  amount: number;
  currency: string;
  direction: string;
  transactionType?: string;
  ttrReference?: string;
  ttrSubmissionDeadline: string;
  ttrSubmissionStatus: string;
  ttrSubmittedAt?: string;
  ttrAustracReference?: string;
  customerId?: string;
  createdAt: string;
}

type FilterStatus = 'all' | 'pending' | 'overdue' | 'submitted';

export default function TTRListPage() {
  const [transactions, setTransactions] = useState<TTRTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/transactions?requires_ttr=true&limit=100');
      if (!response.ok) throw new Error('Failed to fetch TTR transactions');

      const data = await response.json();
      setTransactions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TTR transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const getDaysUntilDeadline = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (deadline: string) => {
    return getDaysUntilDeadline(deadline) < 0;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      generating: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      submitted: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      resubmit_required: 'bg-orange-100 text-orange-800',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const filteredTransactions = transactions.filter((txn) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') {
      return !['submitted', 'accepted'].includes(txn.ttrSubmissionStatus) && !isOverdue(txn.ttrSubmissionDeadline);
    }
    if (filterStatus === 'overdue') {
      return !['submitted', 'accepted'].includes(txn.ttrSubmissionStatus) && isOverdue(txn.ttrSubmissionDeadline);
    }
    if (filterStatus === 'submitted') {
      return ['submitted', 'accepted'].includes(txn.ttrSubmissionStatus);
    }
    return true;
  });

  const stats = {
    total: transactions.length,
    pending: transactions.filter(
      (t) => !['submitted', 'accepted'].includes(t.ttrSubmissionStatus) && !isOverdue(t.ttrSubmissionDeadline)
    ).length,
    overdue: transactions.filter(
      (t) => !['submitted', 'accepted'].includes(t.ttrSubmissionStatus) && isOverdue(t.ttrSubmissionDeadline)
    ).length,
    submitted: transactions.filter((t) => ['submitted', 'accepted'].includes(t.ttrSubmissionStatus)).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Threshold Transaction Reports</h1>
          <p className="mt-1 text-gray-600">Manage and submit TTR reports to AUSTRAC</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-600">Loading TTR reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Threshold Transaction Reports</h1>
          <p className="mt-1 text-gray-600">Manage and submit TTR reports to AUSTRAC</p>
        </div>
        <button
          onClick={fetchTransactions}
          className="flex items-center px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${
            filterStatus === 'all' ? 'ring-2 ring-primary' : 'hover:bg-gray-50'
          }`}

        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total TTRs</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
              <button
                onClick={() => setFilterStatus('all')}
              >All</button>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            filterStatus === 'pending' ? 'ring-2 ring-primary' : 'hover:bg-gray-50'
          }`}

        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
              <button
                onClick={() => setFilterStatus('pending')}
              >Pending</button>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            filterStatus === 'overdue' ? 'ring-2 ring-primary' : 'hover:bg-gray-50'
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <button
                onClick={() => setFilterStatus('overdue')}
              >Overdue</button>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            filterStatus === 'submitted' ? 'ring-2 ring-primary' : 'hover:bg-gray-50'
          }`}

        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-3xl font-bold text-green-600">{stats.submitted}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
              <button
                onClick={() => setFilterStatus('submitted')}
              >  Submitted</button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Overdue Warning */}
      {stats.overdue > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900">
                {stats.overdue} TTR{stats.overdue > 1 ? 's' : ''} Overdue
              </h4>
              <p className="text-sm text-red-800 mt-1">
                You have overdue TTR submissions. AUSTRAC requires TTRs to be submitted within 10
                business days. Please review and submit immediately to avoid penalties.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TTR List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filterStatus === 'all' && 'All TTR Reports'}
            {filterStatus === 'pending' && 'Pending TTRs'}
            {filterStatus === 'overdue' && 'Overdue TTRs'}
            {filterStatus === 'submitted' && 'Submitted TTRs'}
            {' '}({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No TTRs found</h3>
              <p className="text-gray-600">
                {filterStatus === 'all' && 'No transactions require TTR submission.'}
                {filterStatus === 'pending' && 'No pending TTRs at this time.'}
                {filterStatus === 'overdue' && 'No overdue TTRs. Great work!'}
                {filterStatus === 'submitted' && 'No TTRs have been submitted yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((txn) => {
                const daysRemaining = getDaysUntilDeadline(txn.ttrSubmissionDeadline);
                const txnOverdue = daysRemaining < 0;
                const isCritical = daysRemaining <= 2 && daysRemaining >= 0;

                return (
                  <Link
                    key={txn.id}
                    href={`/dashboard/reports/ttr/${txn.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900">
                            {txn.ttrReference || `TTR-${txn.id.slice(0, 8)}`}
                          </h4>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(
                              txn.ttrSubmissionStatus
                            )}`}
                          >
                            {txn.ttrSubmissionStatus.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500">Amount</p>
                            <p className="font-medium text-gray-900">
                              {txn.currency} ${txn.amount.toLocaleString()}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Direction</p>
                            <p className="font-medium text-gray-900 capitalize">{txn.direction}</p>
                          </div>

                          <div>
                            <p className="text-gray-500">Transaction Date</p>
                            <p className="font-medium text-gray-900">
                              {new Date(txn.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Deadline</p>
                            <div className="flex items-center">
                              {txnOverdue ? (
                                <>
                                  <XCircle className="w-4 h-4 text-red-600 mr-1" />
                                  <p className="font-medium text-red-600">
                                    Overdue by {Math.abs(daysRemaining)}d
                                  </p>
                                </>
                              ) : isCritical ? (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-orange-600 mr-1" />
                                  <p className="font-medium text-orange-600">{daysRemaining}d remaining</p>
                                </>
                              ) : (
                                <>
                                  <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                                  <p className="font-medium text-gray-900">{daysRemaining}d remaining</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {txn.ttrAustracReference && (
                          <p className="text-xs text-gray-500 mt-2">
                            AUSTRAC Ref: {txn.ttrAustracReference}
                          </p>
                        )}
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-400 ml-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AUSTRAC Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">About TTR Reporting</h4>
            <p className="text-sm text-blue-800 mt-1">
              Threshold Transaction Reports (TTRs) must be submitted to AUSTRAC within 10 business
              days of a transaction that meets or exceeds $10,000 AUD (or equivalent). Failure to
              submit TTRs on time may result in significant penalties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
