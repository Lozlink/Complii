'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Download,
  Send,
  Clock,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface SMRReport {
  id: string;
  reportNumber: string;
  activityType: string;
  status: string;
  customerId?: string;
  suspicionFormedDate: string;
  submissionDeadline: string;
  suspicionGrounds: string;
  actionTaken: string;
  description: string;
  reportingOfficer: {
    name: string;
    position: string;
    contactNumber: string;
  };
  transactionIds?: string[];
  totalAmount?: number;
  currency?: string;
  austracReference?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  direction: string;
  transactionType?: string;
  description?: string;
  createdAt: string;
}

export default function SMRDetailPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<SMRReport | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In a real implementation, you'd have a GET /api/v1/reports/smr/:id endpoint
      // For now, fetch from the list and find the matching one
      const response = await fetch('/api/proxy/reports/smr?limit=100');
      if (!response.ok) throw new Error('Failed to load report');

      const data = await response.json();
      const smr = (data.data || []).find((r: SMRReport) => r.id === reportId);

      if (!smr) {
        setError('Report not found');
        return;
      }

      setReport(smr);

      // Fetch customer if linked
      if (smr.customerId) {
        try {
          const customerRes = await fetch(`/api/proxy/customers/${smr.customerId}`);
          if (customerRes.ok) {
            setCustomer(await customerRes.json());
          }
        } catch {
          // Customer fetch failed, continue anyway
        }
      }

      // Fetch transactions if linked
      if (smr.transactionIds && smr.transactionIds.length > 0) {
        try {
          const txPromises = smr.transactionIds.map((txId) =>
            fetch(`/api/proxy/transactions/${txId}`).then((r) => (r.ok ? r.json() : null))
          );
          const txResults = await Promise.all(txPromises);
          setTransactions(txResults.filter((tx): tx is Transaction => tx !== null));
        } catch {
          // Transaction fetch failed, continue anyway
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const downloadXML = async () => {
    setDownloading(true);
    try {
      // TODO: Implement XML download endpoint
      // const response = await fetch(`/api/proxy/reports/smr/${reportId}/xml`);
      // const blob = await response.blob();
      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = `${report?.reportNumber || 'smr'}.xml`;
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
    if (!confirm('Submit this SMR to AUSTRAC? This action cannot be undone.')) {
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
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      submitted: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-purple-100 text-purple-800',
    };
    return styles[status as keyof typeof styles] || styles.draft;
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
        <div className="text-gray-500">Loading report...</div>
      </div>
    );
  }

  if (error || !report) {
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
          <p className="text-red-800">{error || 'Report not found'}</p>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysUntilDeadline(report.submissionDeadline);
  const isOverdue = daysRemaining < 0;
  const isCritical = daysRemaining <= 1 && daysRemaining >= 0;

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
          <h1 className="text-3xl font-bold text-gray-900">{report.reportNumber}</h1>
          <p className="mt-1 text-gray-600">Suspicious Matter Report</p>
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
          {report.status !== 'submitted' && report.status !== 'acknowledged' && (
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
                <p className="text-sm text-gray-500">Status</p>
                <p className="mt-1">
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusBadge(report.status)}`}>
                    {report.status.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>
              {report.status === 'submitted' ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
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
                  {new Date(report.submissionDeadline).toLocaleDateString()}
                </p>
                {isOverdue ? (
                  <p className="text-sm text-red-600 font-medium">Overdue by {Math.abs(daysRemaining)} day(s)</p>
                ) : isCritical ? (
                  <p className="text-sm text-orange-600 font-medium">Due in {daysRemaining} day(s)</p>
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

      {/* Report Details */}
      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Activity Type</p>
              <p className="font-medium text-gray-900">{report.activityType.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Suspicion Formed Date</p>
              <p className="font-medium text-gray-900">
                {new Date(report.suspicionFormedDate).toLocaleDateString()}
              </p>
            </div>
            {report.totalAmount && (
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-medium text-gray-900">
                  {report.currency} {report.totalAmount.toLocaleString()}
                </p>
              </div>
            )}
            {report.austracReference && (
              <div>
                <p className="text-sm text-gray-500">AUSTRAC Reference</p>
                <p className="font-medium text-gray-900">{report.austracReference}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">Description</p>
            <p className="text-gray-900">{report.description}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">Grounds for Suspicion</p>
            <p className="text-gray-900 whitespace-pre-wrap">{report.suspicionGrounds}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">Action Taken</p>
            <p className="text-gray-900">{report.actionTaken}</p>
          </div>
        </CardContent>
      </Card>

      {/* Customer */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle>Related Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/customers/${report.customerId}`}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <div className="flex items-center">
                <User className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">
                    {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                  </p>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Transactions ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {tx.currency} {tx.amount.toLocaleString()} - {tx.direction}
                      </p>
                      <p className="text-sm text-gray-600">
                        {tx.transactionType} • {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reporting Officer */}
      <Card>
        <CardHeader>
          <CardTitle>Reporting Officer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{report.reportingOfficer.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Position</p>
              <p className="font-medium text-gray-900">{report.reportingOfficer.position}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contact</p>
              <p className="font-medium text-gray-900">{report.reportingOfficer.contactNumber}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start">
            <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Report Created</p>
              <p className="text-sm text-gray-600">{new Date(report.createdAt).toLocaleString()}</p>
            </div>
          </div>
          {report.reviewedAt && (
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Reviewed by {report.reviewedBy}</p>
                <p className="text-sm text-gray-600">{new Date(report.reviewedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          {report.submittedAt && (
            <div className="flex items-start">
              <Send className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Submitted to AUSTRAC</p>
                <p className="text-sm text-gray-600">{new Date(report.submittedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
