'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  FileText,
  ArrowUpRight,
  MessageSquare,
  ExternalLink,
  Send,
  XCircle,
  DollarSign,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

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
    type: string;
    name: string;
    email?: string;
    riskLevel?: string;
    isPep?: boolean;
  };
  transaction?: {
    id: string;
    amount: number;
    currency: string;
    type?: string;
    description?: string;
    date: string;
  };
  checklistSections?: Record<string, unknown>;
  investigationFindings?: string;
  riskAssessmentSummary?: string;
  complianceRecommendation?: string;
  informationRequests?: Array<{
    id: string;
    requested_at: string;
    items: string[];
    deadline?: string;
    status: string;
  }>;
  escalations?: Array<{
    id: string;
    escalated_at: string;
    reason: string;
    escalated_to: string;
  }>;
  reviewedBy?: string;
  openedAt: string;
  completedAt?: string;
  createdAt: string;
}

export default function EDDDetailPage() {
  const params = useParams();
  const router = useRouter();
  const investigationId = params.id as string;

  const [investigation, setInvestigation] = useState<EDDInvestigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [findings, setFindings] = useState('');
  const [riskSummary, setRiskSummary] = useState('');
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [relatedSMRs, setRelatedSMRs] = useState<Array<{ id: string; reportNumber: string; activityType: string; status: string; createdAt: string }>>([]);

  const fetchInvestigation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/edd/${investigationId}`);
      if (!response.ok) throw new Error('Investigation not found');

      const data = await response.json();
      setInvestigation(data);
      setFindings(data.investigationFindings || '');
      setRiskSummary(data.riskAssessmentSummary || '');

      // Fetch related SMR reports for this customer
      if (data.customerId) {
        const smrResponse = await fetch(`/api/proxy/reports/smr?limit=50`);
        if (smrResponse.ok) {
          const smrData = await smrResponse.json();
          const customerSMRs = (smrData.data || []).filter(
            (smr: { customerId?: string }) => smr.customerId === data.customerId
          );
          setRelatedSMRs(customerSMRs);
        }
      }
    } catch {
      setError('Failed to load investigation details.');
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  useEffect(() => {
    fetchInvestigation();
  }, [fetchInvestigation]);

  const handleAction = async (
    action: string,
    payload: Record<string, unknown> = {}
  ) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/proxy/edd/${investigationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      fetchInvestigation();
      setShowRequestInfoModal(false);
      setShowEscalateModal(false);
      setShowCompleteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      open: { bg: 'bg-blue-100', text: 'text-blue-800' },
      awaiting_customer_info: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      under_review: { bg: 'bg-purple-100', text: 'text-purple-800' },
      escalated: { bg: 'bg-orange-100', text: 'text-orange-800' },
      completed_approved: { bg: 'bg-green-100', text: 'text-green-800' },
      completed_rejected: { bg: 'bg-red-100', text: 'text-red-800' },
      completed_ongoing_monitoring: { bg: 'bg-teal-100', text: 'text-teal-800' },
    };
    return badges[status] || badges.open;
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Loading investigation...</span>
      </div>
    );
  }

  if (error || !investigation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <p className="text-gray-900 font-medium">{error || 'Investigation not found'}</p>
        <Link
          href="/dashboard/edd"
          className="mt-4 inline-flex items-center text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Investigations
        </Link>
      </div>
    );
  }

  const isCompleted = investigation.status.startsWith('completed');
  const statusStyle = getStatusBadge(investigation.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/edd"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Investigations
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {investigation.investigationNumber}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
            >
              {formatStatus(investigation.status)}
            </span>
          </div>
          <p className="mt-2 text-gray-600">{investigation.triggerReason}</p>
        </div>

        {!isCompleted && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowRequestInfoModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
            >
              <Send className="w-4 h-4 inline mr-2" />
              Request Info
            </button>
            <button
              onClick={() => setShowEscalateModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50"
            >
              <ArrowUpRight className="w-4 h-4 inline mr-2" />
              Escalate
            </button>
            <button
              onClick={() => setShowCompleteModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Complete
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Findings & Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Investigation Findings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Findings
                </label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Document your investigation findings..."
                  disabled={isCompleted}
                  className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risk Assessment Summary
                </label>
                <textarea
                  value={riskSummary}
                  onChange={(e) => setRiskSummary(e.target.value)}
                  placeholder="Summarize the risk assessment..."
                  disabled={isCompleted}
                  className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:bg-gray-50"
                />
              </div>
              {!isCompleted && (
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      handleAction('update_notes', {
                        investigationFindings: findings,
                        riskAssessmentSummary: riskSummary,
                      })
                    }
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Information Requests */}
          {investigation.informationRequests &&
            investigation.informationRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Information Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {investigation.informationRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              req.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {req.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(req.requested_at)}
                          </span>
                        </div>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                          {req.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                        {req.deadline && (
                          <p className="mt-2 text-xs text-gray-500">
                            Due: {formatDate(req.deadline)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Escalations */}
          {investigation.escalations && investigation.escalations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-700">Escalation History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {investigation.escalations.map((esc) => (
                    <div
                      key={esc.id}
                      className="p-4 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-orange-800">
                          Escalated to {esc.escalated_to}
                        </span>
                        <span className="text-xs text-orange-600">
                          {formatDate(esc.escalated_at)}
                        </span>
                      </div>
                      <p className="text-sm text-orange-700">{esc.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completion Details */}
          {isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Investigation Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Recommendation</p>
                  <p className="font-medium capitalize">
                    {(investigation.complianceRecommendation || '').replace(/_/g, ' ')}
                  </p>
                </div>
                {investigation.reviewedBy && (
                  <div>
                    <p className="text-sm text-gray-500">Reviewed By</p>
                    <p className="font-medium">{investigation.reviewedBy}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Completed At</p>
                  <p className="font-medium">{formatDate(investigation.completedAt)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {investigation.customer ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{investigation.customer.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="capitalize">{investigation.customer.type}</p>
                  </div>
                  {investigation.customer.email && (
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-sm">{investigation.customer.email}</p>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    {investigation.customer.riskLevel && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          investigation.customer.riskLevel === 'high'
                            ? 'bg-red-100 text-red-800'
                            : investigation.customer.riskLevel === 'medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {investigation.customer.riskLevel} risk
                      </span>
                    )}
                    {investigation.customer.isPep && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        PEP
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/customers/${investigation.customerId}`}
                    className="inline-flex items-center text-sm text-primary hover:text-primary/80"
                  >
                    View Customer Profile
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </>
              ) : (
                <p className="text-gray-500 text-sm">Customer data unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* Related SMR Reports */}
          {relatedSMRs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Related SMR Reports ({relatedSMRs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {relatedSMRs.map((smr) => (
                    <div
                      key={smr.id}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {smr.reportNumber}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {smr.activityType.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            smr.status === 'submitted'
                              ? 'bg-green-100 text-green-800'
                              : smr.status === 'draft'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {smr.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(smr.createdAt).toLocaleDateString()}
                      </p>
                      <Link
                        href="/dashboard/reports"
                        className="inline-flex items-center text-xs text-primary hover:text-primary/80 mt-2"
                      >
                        View Report
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Info */}
          {investigation.transaction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Transaction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-lg font-semibold">
                    {investigation.transaction.currency} $
                    {investigation.transaction.amount.toLocaleString()}
                  </p>
                </div>
                {investigation.transaction.type && (
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="capitalize">{investigation.transaction.type}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="text-sm">{formatDate(investigation.transaction.date)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Opened</p>
                <p className="text-sm">{formatDate(investigation.openedAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Triggered By</p>
                <p className="text-sm capitalize">{investigation.triggeredBy}</p>
              </div>
              {investigation.assignedTo && (
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="text-sm">{investigation.assignedTo}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Request Info Modal */}
      {showRequestInfoModal && (
        <RequestInfoModal
          onClose={() => setShowRequestInfoModal(false)}
          onSubmit={(items, deadline) =>
            handleAction('request_information', { items, deadline })
          }
          loading={actionLoading}
        />
      )}

      {/* Escalate Modal */}
      {showEscalateModal && (
        <EscalateModal
          onClose={() => setShowEscalateModal(false)}
          onSubmit={(reason, escalatedTo) =>
            handleAction('escalate', { reason, escalatedTo })
          }
          loading={actionLoading}
        />
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <CompleteModal
          onClose={() => setShowCompleteModal(false)}
          onSubmit={(recommendation) =>
            handleAction('complete', {
              investigationFindings: findings,
              riskAssessmentSummary: riskSummary,
              complianceRecommendation: recommendation,
            })
          }
          loading={actionLoading}
          findings={findings}
          riskSummary={riskSummary}
        />
      )}
    </div>
  );
}

function RequestInfoModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (items: string[], deadline?: string) => void;
  loading: boolean;
}) {
  const [items, setItems] = useState('');
  const [deadline, setDeadline] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Request Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Documents/Information
            </label>
            <textarea
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="Enter each item on a new line..."
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">One item per line</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const itemList = items
                .split('\n')
                .map((i) => i.trim())
                .filter(Boolean);
              onSubmit(itemList, deadline || undefined);
            }}
            disabled={!items.trim() || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

function EscalateModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (reason: string, escalatedTo: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [escalatedTo, setEscalatedTo] = useState('management');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Escalate Investigation
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Escalate To
            </label>
            <select
              value={escalatedTo}
              onChange={(e) => setEscalatedTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="management">Management</option>
              <option value="compliance_officer">Compliance Officer</option>
              <option value="legal">Legal Team</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Escalation
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being escalated?"
              className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason, escalatedTo)}
            disabled={!reason.trim() || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Escalate
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({
  onClose,
  onSubmit,
  loading,
  findings,
  riskSummary,
}: {
  onClose: () => void;
  onSubmit: (recommendation: string) => void;
  loading: boolean;
  findings: string;
  riskSummary: string;
}) {
  const [recommendation, setRecommendation] = useState('');

  const canComplete = findings.trim() && riskSummary.trim() && recommendation;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Complete Investigation
        </h3>

        {(!findings.trim() || !riskSummary.trim()) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            Please complete the investigation findings and risk assessment before
            finalizing.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compliance Recommendation
            </label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Select a recommendation...</option>
              <option value="approve_relationship">
                Approve Relationship - Continue normal service
              </option>
              <option value="ongoing_monitoring">
                Ongoing Monitoring - Standard periodic review
              </option>
              <option value="enhanced_monitoring">
                Enhanced Monitoring - More frequent review
              </option>
              <option value="reject_relationship">
                Reject Relationship - Terminate/offboard customer
              </option>
              <option value="escalate_to_smr">
                Escalate to SMR - File suspicious matter report
              </option>
            </select>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium text-gray-700 mb-2">Summary:</p>
            <p className="text-gray-600">
              <strong>Findings:</strong>{' '}
              {findings.slice(0, 100)}
              {findings.length > 100 ? '...' : ''}
            </p>
            <p className="text-gray-600 mt-1">
              <strong>Risk Assessment:</strong>{' '}
              {riskSummary.slice(0, 100)}
              {riskSummary.length > 100 ? '...' : ''}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(recommendation)}
            disabled={!canComplete || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Complete Investigation
          </button>
        </div>
      </div>
    </div>
  );
}

