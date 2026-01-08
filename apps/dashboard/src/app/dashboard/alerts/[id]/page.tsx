'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  User,
  FileText,
  ArrowUpRight,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Alert {
  id: string;
  alertNumber: string;
  alertRuleId?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';
  entityType: string;
  entityId: string;
  customerId?: string;
  triggerData?: Record<string, unknown>;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  assignedTo?: string;
  assignedAt?: string;
  investigationNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionType?: string;
  resolutionNotes?: string;
  isEscalated: boolean;
  escalatedTo?: string;
  escalationReason?: string;
  escalatedAt?: string;
  caseId?: string;
  slaDeadline?: string;
  slaBreached?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionType, setResolutionType] = useState('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchAlert = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/proxy/alerts/${alertId}`);
      if (!response.ok) throw new Error('Alert not found');

      const data = await response.json();
      setAlert(data);
      setNotes(data.investigationNotes || '');
    } catch {
      setError('Failed to load alert details.');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const handleAction = async (action: string, payload: Record<string, unknown> = {}) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/proxy/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!response.ok) throw new Error('Action failed');

      fetchAlert();
      setShowEscalateModal(false);
      setShowResolveModal(false);
    } catch {
      setError('Failed to perform action');
    } finally {
      setActionLoading(false);
    }
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
      open: 'bg-red-100 text-red-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      investigating: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || badges.open;
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
        <span className="ml-3 text-gray-600">Loading alert...</span>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <p className="text-gray-900 font-medium">{error || 'Alert not found'}</p>
        <Link
          href="/dashboard/alerts"
          className="mt-4 inline-flex items-center text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Alerts
        </Link>
      </div>
    );
  }

  const isResolved = alert.status === 'resolved' || alert.status === 'dismissed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/alerts"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Alerts
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{alert.title}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${getSeverityBadge(
                alert.severity
              )}`}
            >
              {alert.severity.toUpperCase()}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                alert.status
              )}`}
            >
              {alert.status}
            </span>
            {alert.isEscalated && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                Escalated
              </span>
            )}
          </div>
          <p className="mt-2 text-gray-600">{alert.alertNumber}</p>
        </div>

        {!isResolved && (
          <div className="flex items-center space-x-2">
            {alert.status === 'open' && (
              <button
                onClick={() => handleAction('acknowledge')}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            {!alert.isEscalated && (
              <button
                onClick={() => setShowEscalateModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50"
              >
                Escalate
              </button>
            )}
            <button
              onClick={() => setShowResolveModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{alert.description}</p>

              {alert.triggerData && Object.keys(alert.triggerData).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Trigger Data</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-xs text-gray-700 overflow-auto">
                      {JSON.stringify(alert.triggerData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investigation Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Investigation Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add investigation notes..."
                disabled={isResolved}
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:bg-gray-50"
              />
              {!isResolved && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleAction('update_notes', { investigationNotes: notes })}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Notes
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resolution Details */}
          {isResolved && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Resolution Type</p>
                    <p className="font-medium capitalize">{alert.resolutionType || alert.status}</p>
                  </div>
                  {alert.resolutionNotes && (
                    <div>
                      <p className="text-sm text-gray-500">Resolution Notes</p>
                      <p className="text-gray-700">{alert.resolutionNotes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Resolved By</p>
                    <p className="font-medium">{alert.resolvedBy || 'System'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Resolved At</p>
                    <p className="font-medium">{formatDate(alert.resolvedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Alert Info */}
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Alert Number</p>
                <p className="font-mono text-sm">{alert.alertNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entity Type</p>
                <p className="capitalize">{alert.entityType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entity ID</p>
                <Link
                  href={`/dashboard/${alert.entityType}s/${alert.entityId}`}
                  className="text-primary hover:text-primary/80 flex items-center text-sm"
                >
                  {alert.entityId.slice(0, 8)}...
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </div>
              {alert.customerId && (
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <Link
                    href={`/dashboard/customers/${alert.customerId}`}
                    className="text-primary hover:text-primary/80 flex items-center text-sm"
                  >
                    <User className="w-3 h-3 mr-1" />
                    View Customer
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm">{formatDate(alert.createdAt)}</p>
              </div>
              {alert.acknowledgedAt && (
                <div>
                  <p className="text-sm text-gray-500">Acknowledged</p>
                  <p className="text-sm">{formatDate(alert.acknowledgedAt)}</p>
                </div>
              )}
              {alert.slaDeadline && (
                <div>
                  <p className="text-sm text-gray-500">SLA Deadline</p>
                  <p className={`text-sm ${alert.slaBreached ? 'text-red-600 font-medium' : ''}`}>
                    {formatDate(alert.slaDeadline)}
                    {alert.slaBreached && ' (BREACHED)'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Escalation Info */}
          {alert.isEscalated && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-purple-700">
                  <ArrowUpRight className="w-5 h-5 mr-2" />
                  Escalation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Escalated To</p>
                  <p className="font-medium">{alert.escalatedTo || 'Management'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-gray-700">{alert.escalationReason}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Escalated At</p>
                  <p className="text-sm">{formatDate(alert.escalatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked Case */}
          {alert.caseId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Linked Case
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/dashboard/cases/${alert.caseId}`}
                  className="text-primary hover:text-primary/80 flex items-center"
                >
                  View Case
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Escalate Alert</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Escalation Reason
                </label>
                <textarea
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="Why is this being escalated?"
                  className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowEscalateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('escalate', { escalationReason })}
                disabled={!escalationReason.trim() || actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolve Alert</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Type
                </label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="resolved">Resolved - Issue Addressed</option>
                  <option value="false_positive">False Positive</option>
                  <option value="no_action_required">No Action Required</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Notes
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add resolution details..."
                  className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleAction('resolve', { resolutionType, resolutionNotes })
                }
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

