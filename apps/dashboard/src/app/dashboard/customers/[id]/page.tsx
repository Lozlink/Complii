'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, FileText, CreditCard, RefreshCw, Building2, User, X, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Customer {
  id: string;
  email: string;
  customerType?: 'individual' | 'business';
  firstName?: string;
  middleName?: string;
  lastName?: string;
  companyName?: string;
  abn?: string;
  acn?: string;
  phone?: string;
  dateOfBirth?: string;
  residentialAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  verificationStatus: string;
  riskLevel: string;
  riskScore?: number;
  isSanctioned: boolean;
  isPep: boolean;
  requiresEdd?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  direction: string;
  status: string;
  createdAt: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'stripe_identity' | 'manual'>('stripe_identity');
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(['passport']);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/customers/${customerId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Customer not found');
        } else {
          setError('Failed to load customer');
        }
        return;
      }
      const data = await response.json();
      setCustomer(data);

      // Fetch transactions for this customer
      const txResponse = await fetch(`/api/proxy/transactions?customer_id=${customerId}&limit=10`);
      if (txResponse.ok) {
        const txData = await txResponse.json();
        setTransactions(txData.data || []);
      }
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const handleTriggerKyc = async () => {
    setKycLoading(true);
    try {
      // Force new verification if restarting or re-verifying
      const shouldForce = customer?.verificationStatus === 'pending' || customer?.verificationStatus === 'verified';

      const body: Record<string, unknown> = {
        provider: selectedProvider,
        returnUrl: window.location.href,
        force: shouldForce,
      };

      if (selectedProvider === 'manual') {
        body.documentTypes = selectedDocTypes;
      }

      const response = await fetch(`/api/proxy/customers/${customerId}/kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setShowKycModal(false);

        if (selectedProvider === 'stripe_identity' && data.url) {
          window.open(data.url);
          alert('Stripe Identity verification opened in a new tab.');
        } else if (selectedProvider === 'manual') {
          alert('Manual verification started! Documents can be uploaded via the Documents page.');
        }

        await fetchCustomer();
      } else {
        const data = await response.json();
        alert(`Failed to initiate KYC verification: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('KYC trigger error:', err);
      alert('An error occurred while starting verification');
    } finally {
      setKycLoading(false);
    }
  };

  const toggleDocType = (docType: string) => {
    setSelectedDocTypes((prev) =>
      prev.includes(docType) ? prev.filter((d) => d !== docType) : [...prev, docType]
    );
  };

  const DOCUMENT_TYPES = [
    { value: 'passport', label: 'Passport' },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'national_id', label: 'National ID' },
    { value: 'utility_bill', label: 'Utility Bill (Address)' },
    { value: 'bank_statement', label: 'Bank Statement (Address)' },
  ];

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const getStatusBadge = (status: string): { class: string; icon: typeof CheckCircle } => {
    const defaultBadge = { class: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    const badges: Record<string, { class: string; icon: typeof CheckCircle }> = {
      verified: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: defaultBadge,
      rejected: { class: 'bg-red-100 text-red-800', icon: Shield },
      unverified: { class: 'bg-gray-100 text-gray-800', icon: AlertTriangle },
    };
    return badges[status] ?? defaultBadge;
  };

  const getRiskBadge = (risk: string) => {
    const badges: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[risk] || badges.low;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Loading customer...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Link>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{error || 'Customer not found'}</h2>
              <p className="text-gray-600 mb-6">Unable to load customer details.</p>
              <button
                onClick={fetchCustomer}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = getStatusBadge(customer.verificationStatus);
  const displayName = customer.customerType === 'business'
    ? customer.companyName
    : `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {customer.customerType === 'business' ? (
              <Building2 className="w-8 h-8 text-gray-400" />
            ) : (
              <User className="w-8 h-8 text-gray-400" />
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
              <p className="mt-1 text-gray-600">{customer.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskBadge(customer.riskLevel)}`}>
              {customer.riskLevel} risk
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.class}`}>
              <statusBadge.icon className="w-4 h-4 mr-1.5" />
              {customer.verificationStatus}
            </span>
          </div>
        </div>
      </div>

      {/* KYC Verification Modal */}
      {showKycModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Start Identity Verification</CardTitle>
                <button
                  onClick={() => setShowKycModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Method
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="provider"
                        value="stripe_identity"
                        checked={selectedProvider === 'stripe_identity'}
                        onChange={() => setSelectedProvider('stripe_identity')}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Stripe Identity (Automated)</p>
                        <p className="text-xs text-gray-500">
                          Customer captures ID and selfie via Stripe. Instant verification.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="provider"
                        value="manual"
                        checked={selectedProvider === 'manual'}
                        onChange={() => setSelectedProvider('manual')}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Manual Review</p>
                        <p className="text-xs text-gray-500">
                          Customer uploads documents. Staff reviews and approves.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {selectedProvider === 'manual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Required Documents
                    </label>
                    <div className="space-y-1 border rounded-lg p-2 max-h-40 overflow-y-auto">
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
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowKycModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTriggerKyc}
                    disabled={kycLoading || (selectedProvider === 'manual' && selectedDocTypes.length === 0)}
                    className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {kycLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {kycLoading ? 'Starting...' : 'Start Verification'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{customer.customerType === 'business' ? 'Business' : 'Personal'} Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {customer.customerType === 'business' ? (
                <>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{customer.companyName || '-'}</dd>
                  </div>
                  {customer.abn && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">ABN</dt>
                      <dd className="mt-1 text-sm text-gray-900">{customer.abn}</dd>
                    </div>
                  )}
                  {customer.acn && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">ACN</dt>
                      <dd className="mt-1 text-sm text-gray-900">{customer.acn}</dd>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {[customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ') || '-'}
                    </dd>
                  </div>
                  {customer.dateOfBirth && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(customer.dateOfBirth).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.email}</dd>
              </div>
              {customer.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{customer.phone}</dd>
                </div>
              )}
              {customer.residentialAddress && (
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {[
                      customer.residentialAddress.line1,
                      customer.residentialAddress.line2,
                      customer.residentialAddress.city,
                      customer.residentialAddress.state,
                      customer.residentialAddress.postcode,
                      customer.residentialAddress.country,
                    ].filter(Boolean).join(', ') || '-'}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(customer.createdAt).toLocaleString()}
                </dd>
              </div>
              {customer.updatedAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(customer.updatedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Compliance Flags */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 text-gray-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">Sanctions</span>
                </div>
                {customer.isSanctioned ? (
                  <span className="text-sm text-red-600 font-medium">Match</span>
                ) : (
                  <span className="text-sm text-green-600 font-medium">Clear</span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-gray-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">PEP Status</span>
                </div>
                {customer.isPep ? (
                  <span className="text-sm text-orange-600 font-medium">Yes</span>
                ) : (
                  <span className="text-sm text-green-600 font-medium">No</span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-gray-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900">Risk Level</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskBadge(customer.riskLevel)}`}>
                  {customer.riskLevel}
                  {customer.riskScore !== undefined && ` (${customer.riskScore})`}
                </span>
              </div>
              {customer.requiresEdd && (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Enhanced DD</span>
                  </div>
                  <span className="text-sm text-purple-600 font-medium">Required</span>
                </div>
              )}

              <button
                onClick={() => setShowKycModal(true)}
                className={`w-full mt-2 inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                  customer.verificationStatus === 'verified'
                    ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                    : 'border-transparent text-white bg-primary hover:bg-primary/90'
                }`}
              >
                <Shield className="w-4 h-4 mr-2" />
                {customer.verificationStatus === 'verified'
                  ? 'Re-verify Identity'
                  : customer.verificationStatus === 'pending'
                    ? 'Restart Verification'
                    : 'Verify Identity'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <CreditCard className="w-4 h-4 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{txn.direction}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {txn.currency} ${txn.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-green-600 capitalize">{txn.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">No transactions found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
