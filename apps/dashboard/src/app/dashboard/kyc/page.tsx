'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  AlertCircle,
  Plus,
  X,
  type LucideIcon,
} from 'lucide-react';
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

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  verificationStatus?: string;
}

interface StatusBadge {
  class: string;
  icon: LucideIcon;
}

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'citizenship_certificate', label: 'Citizenship Certificate' },
  { value: 'medicare_card', label: 'Medicare Card' },
  { value: 'proof_of_age', label: 'Proof of Age Card' },
  { value: 'utility_bill', label: 'Utility Bill (Address)' },
  { value: 'bank_statement', label: 'Bank Statement (Address)' },
];

export default function KycPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Manual verification form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(['passport']);
  const [startingVerification, setStartingVerification] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(`/api/proxy/identity-verifications?${params.toString()}`);
      if (!response.ok) throw new Error('API unavailable');

      const data = await response.json();
      setVerifications(data.data || []);
    } catch {
      setError('Failed to load verifications. Please try again.');
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const response = await fetch('/api/proxy/customers?limit=100');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data.data || []);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  useEffect(() => {
    if (showManualForm) {
      fetchCustomers();
    }
  }, [showManualForm, fetchCustomers]);

  const handleReview = async (id: string, decision: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      const reason = decision === 'reject' ? prompt('Please enter rejection reason:') : null;
      if (decision === 'reject' && !reason) {
        setActionLoading(null);
        return;
      }

      const response = await fetch(`/api/proxy/identity-verifications/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: reason || undefined,
          notes: decision === 'reject' ? 'Rejected via dashboard' : 'Approved via dashboard',
        }),
      });

      if (response.ok) {
        fetchVerifications();
        alert(`Verification ${decision === 'approve' ? 'approved' : 'rejected'} successfully!`);
      } else {
        const data = await response.json();
        alert(`Failed to ${decision} verification: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert(`Failed to ${decision} verification`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartManualVerification = async () => {
    if (!selectedCustomerId || selectedDocTypes.length === 0) {
      alert('Please select a customer and at least one document type.');
      return;
    }

    setStartingVerification(true);
    try {
      const response = await fetch(`/api/proxy/customers/${selectedCustomerId}/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'manual',
          documentTypes: selectedDocTypes,
        }),
      });

      if (response.ok) {
        setShowManualForm(false);
        setSelectedCustomerId('');
        setSelectedDocTypes(['passport']);
        await fetchVerifications();
        alert('Manual verification started! The customer can now upload their documents.');
      } else {
        const data = await response.json();
        alert(`Failed to start verification: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to start verification. Please try again.');
    } finally {
      setStartingVerification(false);
    }
  };

  const toggleDocType = (docType: string) => {
    setSelectedDocTypes((prev) =>
      prev.includes(docType) ? prev.filter((d) => d !== docType) : [...prev, docType]
    );
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

  const getStatusBadge = (status: string): StatusBadge => {
    const defaultBadge: StatusBadge = { class: 'bg-yellow-100 text-yellow-800', icon: Clock };
    const badges: Record<string, StatusBadge> = {
      verified: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      requires_input: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { class: 'bg-blue-100 text-blue-800', icon: Clock },
      rejected: { class: 'bg-red-100 text-red-800', icon: XCircle },
    };
    return badges[status] ?? defaultBadge;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
          <p className="mt-2 text-gray-600">Review and manage customer identity verifications</p>
        </div>
        <button
          onClick={() => setShowManualForm(true)}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Start Manual Verification
        </button>
      </div>

      {/* Manual Verification Modal */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Start Manual Verification</CardTitle>
                <button
                  onClick={() => setShowManualForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>Manual Verification:</strong> Start a verification that requires document
                  upload and manual review. The customer will need to upload the required documents
                  via the Documents page.
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Customer *
                  </label>
                  {customersLoading ? (
                    <div className="flex items-center text-gray-500">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Loading customers...
                    </div>
                  ) : (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">-- Select a customer --</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} ({customer.email})
                          {customer.verificationStatus === 'verified' ? ' - Verified' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {customers.length === 0 && !customersLoading && (
                    <p className="mt-2 text-sm text-gray-500">
                      No customers found. Create a customer first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Documents * (select all that apply)
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {DOCUMENT_TYPES.map((docType) => (
                      <label
                        key={docType.value}
                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocTypes.includes(docType.value)}
                          onChange={() => toggleDocType(docType.value)}
                          className="mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-900">{docType.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowManualForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartManualVerification}
                    disabled={!selectedCustomerId || selectedDocTypes.length === 0 || startingVerification}
                    className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {startingVerification && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {startingVerification ? 'Starting...' : 'Start Verification'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
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
                const BadgeIcon = badge.icon;
                const canReview =
                  verification.provider === 'manual' &&
                  (verification.status === 'pending' || verification.status === 'requires_input');

                return (
                  <div
                    key={verification.id}
                    className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="text-base font-semibold text-gray-900">
                            {verification.customerName}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badge.class}`}
                          >
                            <BadgeIcon className="w-3 h-3 mr-1" />
                            {verification.status.replace('_', ' ')}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              verification.provider === 'manual'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {verification.provider === 'manual' ? 'Manual' : 'Stripe Identity'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                          <div>
                            <span className="font-medium">Email:</span> {verification.email || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span> {verification.id}
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
                            <p className="text-sm text-red-800 mt-1">{verification.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {canReview && (
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
              <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No verifications found</p>
              <button
                onClick={() => setShowManualForm(true)}
                className="mt-4 text-primary hover:underline"
              >
                Start a manual verification
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
