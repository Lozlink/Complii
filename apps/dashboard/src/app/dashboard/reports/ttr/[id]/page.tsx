'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Download,
  Send,
  Clock,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  FileText,
  Building,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface TTRTransaction {
  id: string;
  amount: number;
  currency: string;
  direction: string;
  transactionType?: string;
  description?: string;
  reference?: string;
  ttrReference?: string;
  ttrSubmissionDeadline: string;
  ttrSubmissionStatus: string;
  ttrSubmittedAt?: string;
  ttrAustracReference?: string;
  ttrRejectionReason?: string;
  ttrSubmissionAttempts?: number;
  customerId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  customerType?: string;
}

export default function TTRDetailPage() {
  const params = useParams();
  const transactionId = params.id as string;

  const [transaction, setTransaction] = useState<TTRTransaction | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchTransaction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/transactions/${transactionId}`);
      if (!response.ok) throw new Error('Failed to load transaction');

      const data = await response.json();

      if (!data.requiresTtr) {
        setError('This transaction does not require a TTR');
        return;
      }

      setTransaction(data);

      // Fetch customer if linked
      if (data.customerId) {
        try {
          const customerRes = await fetch(`/api/proxy/customers/${data.customerId}`);
          if (customerRes.ok) {
            setCustomer(await customerRes.json());
          }
        } catch {
          // Customer fetch failed, continue anyway
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction');
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  const downloadXML = async () => {
    setDownloading(true);
    try {
      // TODO: Implement XML download endpoint
      // const response = await fetch(`/api/proxy/transactions/${transactionId}/ttr/xml`);
      // const blob = await response.blob();
      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = `TTR_${transaction?.ttrReference || transactionId}.xml`;
      // a.click();
      // URL.revokeObjectURL(url);
      alert('XML download endpoint not yet implemented');
    } catch (err) {
      alert('Failed to download XML');
    } finally {
      setDownloading(false);
    }
  };

  const submitToAUSTRAC = async () => {
    if (!confirm('Submit this TTR to AUSTRAC? This action cannot be undone.')) {
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Implement submission endpoint
      alert('AUSTRAC submission endpoint not yet implemented');
    } catch (err) {
      alert('Failed to submit to AUSTRAC');
    } finally {
      setSubmitting(false);
    }
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

  const getDaysUntilDeadline = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading TTR...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/reports"
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error || 'Transaction not found'}</p>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysUntilDeadline(transaction.ttrSubmissionDeadline);
  const isOverdue = daysRemaining < 0;
  const isCritical = daysRemaining <= 2 && daysRemaining >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/reports"
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {transaction.ttrReference || `TTR-${transaction.id}`}
          </h1>
          <p className="mt-1 text-gray-600">Threshold Transaction Report</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadXML}
            disabled={downloading}
            className="flex items-center px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading ? 'Downloading...' : 'Download XML'}
          </button>
          {transaction.ttrSubmissionStatus !== 'submitted' &&
           transaction.ttrSubmissionStatus !== 'accepted' && (
            <button
              onClick={submitToAUSTRAC}
              disabled={submitting}
              className="flex items-center px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit to AUSTRAC'}
            </button>
          )}
        </div>
      </div>

      {/* Status & Deadline Alert */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Submission Status</p>
                <p className="mt-1">
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusBadge(transaction.ttrSubmissionStatus)}`}>
                    {transaction.ttrSubmissionStatus.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>
              {transaction.ttrSubmissionStatus === 'accepted' ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : transaction.ttrSubmissionStatus === 'rejected' ? (
                <XCircle className="w-8 h-8 text-red-600" />
              ) : (
                <Clock className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Submission Deadline</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {new Date(transaction.ttrSubmissionDeadline).toLocaleDateString()}
                </p>
                {isOverdue ? (
                  <p className="text-sm text-red-600 font-medium">
                    Overdue by {Math.abs(daysRemaining)} day(s)
                  </p>
                ) : isCritical ? (
                  <p className="text-sm text-orange-600 font-medium">
                    Due in {daysRemaining} day(s)
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">{daysRemaining} day(s) remaining</p>
                )}
              </div>
              {isOverdue ? (
                <XCircle className="w-8 h-8 text-red-600" />
              ) : isCritical ? (
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              ) : (
                <Calendar className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejection Notice */}
      {transaction.ttrSubmissionStatus === 'rejected' && transaction.ttrRejectionReason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900">TTR Rejected by AUSTRAC</h4>
              <p className="text-sm text-red-800 mt-1">{transaction.ttrRejectionReason}</p>
              {transaction.ttrSubmissionAttempts && (
                <p className="text-xs text-red-700 mt-2">
                  Submission attempts: {transaction.ttrSubmissionAttempts}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium text-gray-900 text-2xl">
                {transaction.currency} {transaction.amount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Direction</p>
              <p className="font-medium text-gray-900 capitalize">{transaction.direction}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Transaction Type</p>
              <p className="font-medium text-gray-900">
                {transaction.transactionType || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Transaction Date</p>
              <p className="font-medium text-gray-900">
                {new Date(transaction.createdAt).toLocaleDateString()}
              </p>
            </div>
            {transaction.reference && (
              <div>
                <p className="text-sm text-gray-500">Reference</p>
                <p className="font-medium text-gray-900">{transaction.reference}</p>
              </div>
            )}
            {transaction.ttrAustracReference && (
              <div>
                <p className="text-sm text-gray-500">AUSTRAC Reference</p>
                <p className="font-medium text-gray-900">{transaction.ttrAustracReference}</p>
              </div>
            )}
          </div>

          {transaction.description && (
            <div>
              <p className="text-sm text-gray-500 mb-2">Description</p>
              <p className="text-gray-900">{transaction.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/customers/${transaction.customerId}`}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <div className="flex items-center">
                {customer.customerType === 'business' ? (
                  <Building className="w-5 h-5 text-gray-400 mr-3" />
                ) : (
                  <User className="w-5 h-5 text-gray-400 mr-3" />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {customer.customerType === 'business'
                      ? customer.companyName
                      : `${customer.firstName} ${customer.lastName}`}
                  </p>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Submission History */}
      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start">
            <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Transaction Created</p>
              <p className="text-sm text-gray-600">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          {transaction.ttrSubmittedAt && (
            <div className="flex items-start">
              <Send className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Submitted to AUSTRAC</p>
                <p className="text-sm text-gray-600">
                  {new Date(transaction.ttrSubmittedAt).toLocaleString()}
                </p>
                {transaction.ttrAustracReference && (
                  <p className="text-xs text-gray-500 mt-1">
                    Reference: {transaction.ttrAustracReference}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AUSTRAC Requirements Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">AUSTRAC TTR Requirements</h4>
            <p className="text-sm text-blue-800 mt-1">
              Threshold Transaction Reports must be submitted to AUSTRAC within 10 business days
              of the transaction occurring. Ensure all transaction details are accurate before
              submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
