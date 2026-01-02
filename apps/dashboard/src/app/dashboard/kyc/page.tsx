'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Clock, CheckCircle, XCircle, FileText, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Verification {
  id: string;
  customerId: string;
  customerName?: string;
  email?: string;
  provider: string;
  status: 'pending' | 'requires_input' | 'processing' | 'verified' | 'rejected';
  verifiedFirstName?: string;
  verifiedLastName?: string;
  documentType?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

// Fallback mock data
const mockVerifications: Verification[] = [
  {
    id: 'kyc_demo_1',
    customerId: 'cus_1',
    customerName: 'John Smith',
    email: 'john.smith@example.com',
    provider: 'stripe_identity',
    status: 'verified',
    verifiedFirstName: 'John',
    verifiedLastName: 'Smith',
    documentType: 'passport',
    createdAt: '2025-12-15T10:30:00Z',
  },
  {
    id: 'kyc_demo_2',
    customerId: 'cus_2',
    customerName: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    provider: 'manual',
    status: 'pending',
    documentType: 'drivers_license',
    createdAt: '2025-12-20T14:30:00Z',
  },
  {
    id: 'kyc_demo_3',
    customerId: 'cus_3',
    customerName: 'Michael Chen',
    email: 'mchen@example.com',
    provider: 'stripe_identity',
    status: 'rejected',
    documentType: 'passport',
    rejectionReason: 'Document quality insufficient',
    createdAt: '2025-12-18T09:15:00Z',
  },
];

export default function KycPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(`/api/proxy/identity-verifications?${params.toString()}`);
      if (!response.ok) throw new Error('API unavailable');

      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setVerifications(data.data);
        setUsingMockData(false);
      } else {
        setVerifications(mockVerifications);
        setUsingMockData(true);
      }
    } catch {
      setVerifications(mockVerifications);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleReview = async (id: string, decision: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/proxy/identity-verifications/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes: decision === 'reject' ? 'Rejected via dashboard' : undefined,
        }),
      });

      if (response.ok) {
        // Refresh the list
        fetchVerifications();
      } else {
        alert(`Failed to ${decision} verification`);
      }
    } catch {
      alert(`Failed to ${decision} verification`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredVerifications =
    filterStatus === 'all'
      ? verifications
      : verifications.filter((v) => v.status === filterStatus);

  const stats = {
    total: verifications.length,
    verified: verifications.filter((v) => v.status === 'verified').length,
    pending: verifications.filter((v) => v.status === 'pending' || v.status === 'requires_input').length,
    rejected: verifications.filter((v) => v.status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; icon: typeof CheckCircle }> = {
      verified: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      requires_input: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { class: 'bg-blue-100 text-blue-800', icon: Clock },
      rejected: { class: 'bg-red-100 text-red-800', icon: XCircle },
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
        <p className="mt-2 text-gray-600">Review and manage customer identity verifications</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Verifications</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <UserCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Verified</p>
                <p className="mt-2 text-3xl font-semibold text-green-600">{stats.verified}</p>
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
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="mt-2 text-3xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="bg-yellow-100 rounded-lg p-3">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="mt-2 text-3xl font-semibold text-red-600">{stats.rejected}</p>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Verification Queue</CardTitle>
            <div className="flex items-center space-x-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={fetchVerifications}
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
          {usingMockData && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              Showing demo data. Connect to the API to see real verifications.
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading verifications...</span>
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              {filteredVerifications.map((verification) => {
                const badge = getStatusBadge(verification.status);
                //todo fix this undefined shit
                const BadgeIcon = Clock;
                return (
                  <div
                    key={verification.id}
                    className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="text-base font-semibold text-gray-900">
                            {verification.customerName || `Customer ${verification.customerId}`}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badge.class}`}
                          >
                            <BadgeIcon className="w-3 h-3 mr-1" />
                            {verification.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                          <div>
                            <span className="font-medium">Email:</span> {verification.email || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Provider:</span>{' '}
                            <span className="capitalize">
                              {verification.provider.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Submitted:</span>{' '}
                            {new Date(verification.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {verification.documentType && (
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-medium text-gray-700">Document:</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                              <FileText className="w-3 h-3 mr-1" />
                              {verification.documentType.replace('_', ' ')}
                            </span>
                          </div>
                        )}

                        {verification.rejectionReason && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-red-900">Rejection Reason:</p>
                            <p className="text-sm text-red-800 mt-1">
                              {verification.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>

                      {(verification.status === 'pending' || verification.status === 'requires_input') && (
                        <div className="flex flex-col space-y-2 ml-4">
                          <button
                            onClick={() => handleReview(verification.id, 'approve')}
                            disabled={actionLoading === verification.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                          >
                            {actionLoading === verification.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReview(verification.id, 'reject')}
                            disabled={actionLoading === verification.id}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filteredVerifications.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No verifications found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
