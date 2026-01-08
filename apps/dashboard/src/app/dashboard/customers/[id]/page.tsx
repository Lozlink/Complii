'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  FileText,
  CreditCard,
  RefreshCw,
  Building2,
  User,
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  UserCheck,
  FolderOpen,
  Flag,
  Download,
  Eye,
  Upload,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ActionItem {
  id: string;
  type: 'kyc' | 'documents' | 'sanctions' | 'pep' | 'transactions' | 'smr' | 'edd';
  priority: 'high' | 'medium';
  title: string;
  description: string;
  count?: number;
  metadata?: Record<string, unknown>;
}

interface KycVerification {
  id: string;
  status: string;
  provider: string;
}

interface Document {
  id: string;
  documentType: string;
  status: string;
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  createdAt?: string;
}

interface SanctionsScreening {
  id: string;
  status: string;
  matchScore?: number;
}

interface PepScreening {
  id: string;
  status: string;
  matchScore?: number;
}

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
  const customerIdParam = params.id as string;
  // Strip cus_ prefix to get actual UUID for DB queries
  const customerId = customerIdParam.startsWith('cus_') ? customerIdParam.slice(4) : customerIdParam;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'stripe_identity' | 'manual'>('stripe_identity');
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(['passport']);

  // Action items state
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [reviewingKyc, setReviewingKyc] = useState(false);
  const [kycDocuments, setKycDocuments] = useState<Document[]>([]);
  const [expandedKyc, setExpandedKyc] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  // Document upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('passport');
  const [uploading, setUploading] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState(true);
  const [pendingVerificationId, setPendingVerificationId] = useState<string | null>(null);

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

  const fetchActionItems = useCallback(async () => {
    setActionsLoading(true);
    try {
      const items: ActionItem[] = [];

      // Fetch all data in parallel
      const [kycRes, docsRes, sanctionsRes, pepRes, flaggedRes, smrRes, eddRes] = await Promise.all([
        fetch(`/api/proxy/customers/${customerId}/kyc`).catch(() => null),
        fetch(`/api/proxy/customers/${customerId}/kyc/documents?limit=20`).catch(() => null),
        fetch(`/api/proxy/sanctions/history?customer_id=${customerId}&status=potential_match&limit=5`).catch(() => null),
        fetch(`/api/proxy/pep/history?customer_id=${customerId}&status=potential_match&limit=5`).catch(() => null),
        fetch(`/api/proxy/transactions?customer_id=${customerId}&status=flagged&limit=10`).catch(() => null),
        fetch(`/api/proxy/reports/smr?limit=10`).catch(() => null),
        fetch(`/api/proxy/edd?customerId=${customerId}&limit=10`).catch(() => null),
      ]);

      // Check KYC verification needing review and get documents
      let hasPendingKyc = false;
      if (kycRes?.ok) {
        const kyc: KycVerification = await kycRes.json();
        if (kyc.provider === 'manual' && ['pending', 'requires_input'].includes(kyc.status)) {
          hasPendingKyc = true;
          setPendingVerificationId(kyc.id);
          items.push({
            id: kyc.id,
            type: 'kyc',
            priority: 'high',
            title: 'KYC Pending Review',
            description: 'Manual verification awaiting review',
          });
        } else {
          setPendingVerificationId(null);
        }
      } else {
        setPendingVerificationId(null);
      }

      // Store documents for inline viewing
      if (docsRes?.ok) {
        const docsData = await docsRes.json();
        const docs: Document[] = docsData.data || [];
        setKycDocuments(docs);

        // Only show separate documents action item if no pending KYC (to avoid duplication)
        const pendingDocs = docs.filter((d) => d.status === 'pending');
        if (pendingDocs.length > 0 && !hasPendingKyc) {
          const docTypes = pendingDocs.map((d) => d.documentType.replace('_', ' ')).join(', ');
          items.push({
            id: 'docs',
            type: 'documents',
            priority: 'medium',
            title: `${pendingDocs.length} Document${pendingDocs.length > 1 ? 's' : ''} Pending`,
            description: docTypes,
            count: pendingDocs.length,
          });
        }
      } else {
        setKycDocuments([]);
      }

      // Check sanctions matches
      if (sanctionsRes?.ok) {
        const sanctionsData = await sanctionsRes.json();
        const sanctions: SanctionsScreening[] = sanctionsData.data || [];
        const topSanction = sanctions[0];
        if (topSanction) {
          items.push({
            id: topSanction.id,
            type: 'sanctions',
            priority: 'high',
            title: `Sanctions Match${topSanction.matchScore ? ` (${topSanction.matchScore}%)` : ''}`,
            description: 'Potential match found - requires review',
          });
        }
      }

      // Check PEP matches
      if (pepRes?.ok) {
        const pepData = await pepRes.json();
        const peps: PepScreening[] = pepData.data || [];
        const topPep = peps[0];
        if (topPep) {
          items.push({
            id: topPep.id,
            type: 'pep',
            priority: 'high',
            title: `PEP Match${topPep.matchScore ? ` (${topPep.matchScore}%)` : ''}`,
            description: 'Politically exposed person match - requires review',
          });
        }
      }

      // Check flagged transactions
      if (flaggedRes?.ok) {
        const flaggedData = await flaggedRes.json();
        const flagged: Transaction[] = flaggedData.data || [];
        if (flagged.length > 0) {
          items.push({
            id: 'flagged',
            type: 'transactions',
            priority: 'medium',
            title: `${flagged.length} Flagged Transaction${flagged.length > 1 ? 's' : ''}`,
            description: 'Transactions requiring review',
            count: flagged.length,
          });
        }
      }

      // Check SMR reports
      if (smrRes?.ok) {
        const smrData = await smrRes.json();
        console.log('[Customer Page] SMR data:', smrData);
        const smrReports = (smrData.data || []).filter((smr: { customerId?: string }) => smr.customerId === customerId);
        console.log('[Customer Page] Filtered SMR reports for customer:', customerId, smrReports);
        
        smrReports.forEach((smr: { id: string; reportNumber: string; activityType: string; status: string }) => {
          items.push({
            id: smr.id,
            type: 'smr',
            priority: 'high',
            title: `SMR: ${smr.activityType.replace(/_/g, ' ')}`,
            description: `Report ${smr.reportNumber} - Status: ${smr.status}`,
            metadata: { reportNumber: smr.reportNumber, status: smr.status },
          });
        });
      } else {
        console.log('[Customer Page] SMR fetch failed or not ok:', smrRes?.status);
      }

      // Check EDD investigations
      if (eddRes?.ok) {
        const eddData = await eddRes.json();
        console.log('[Customer Page] EDD data:', eddData);
        const eddInvestigations = (eddData.data || []).filter((edd: { customerId?: string }) => edd.customerId === customerId);
        console.log('[Customer Page] Filtered EDD investigations for customer:', customerId, eddInvestigations);
        const openEdds = eddInvestigations.filter((edd: { status: string }) => 
          ['open', 'awaiting_customer_info', 'under_review', 'escalated'].includes(edd.status)
        );

        if (openEdds.length > 0) {
          const edd = openEdds[0];
          items.push({
            id: edd.id,
            type: 'edd',
            priority: 'high',
            title: `EDD Investigation: ${edd.status.replace(/_/g, ' ')}`,
            description: edd.triggerReason || 'Enhanced due diligence required',
            metadata: { investigationNumber: edd.investigationNumber },
          });
        }
      } else {
        console.log('[Customer Page] EDD fetch failed or not ok:', eddRes?.status);
      }

      console.log('[Customer Page] Final action items:', items);
      setActionItems(items);
    } catch (err) {
      console.error('Failed to fetch action items:', err);
    } finally {
      setActionsLoading(false);
    }
  }, [customerId]);

  const handleKycReview = async (verificationId: string, decision: 'approve' | 'reject') => {
    setReviewingKyc(true);
    try {
      const reason = decision === 'reject' ? prompt('Please enter rejection reason:') : null;
      if (decision === 'reject' && !reason) {
        setReviewingKyc(false);
        return;
      }

      const response = await fetch(`/api/proxy/identity-verifications/${verificationId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: reason || undefined,
          notes: `${decision === 'approve' ? 'Approved' : 'Rejected'} via customer detail page`,
        }),
      });

      if (response.ok) {
        alert(`Verification ${decision === 'approve' ? 'approved' : 'rejected'} successfully!`);
        await Promise.all([fetchCustomer(), fetchActionItems()]);
      } else {
        const data = await response.json();
        alert(`Failed to ${decision} verification: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert(`Failed to ${decision} verification`);
    } finally {
      setReviewingKyc(false);
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    setDownloadingDoc(doc.id);
    try {
      const response = await fetch(`/api/proxy/customers/${customerId}/kyc/documents/${doc.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || `${doc.documentType}.${doc.fileType || 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download document');
      }
    } catch {
      alert('Failed to download document');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    setDownloadingDoc(doc.id);
    try {
      const response = await fetch(`/api/proxy/customers/${customerId}/kyc/documents/${doc.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        alert('Failed to view document');
      }
    } catch {
      alert('Failed to view document');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentType', uploadDocType);
      if (pendingVerificationId) {
        formData.append('verificationId', pendingVerificationId);
      }

      const response = await fetch(`/api/proxy/customers/${customerId}/kyc/documents`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Document uploaded successfully!');
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadDocType('passport');
        await fetchActionItems();
      } else {
        const data = await response.json();
        alert(`Failed to upload document: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

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
    fetchActionItems();
  }, [fetchCustomer, fetchActionItems]);

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

      {/* Action Items Card */}
      <Card className={actionItems.length > 0 ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              {actionItems.length > 0 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  Action Required ({actionItems.length})
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 " />
                  No Action Required
                </>
              )}
            </CardTitle>
            <button
              onClick={fetchActionItems}
              disabled={actionsLoading}
              className="p-2 text-gray-500 hover:bg-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${actionsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {actionsLoading && actionItems.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Checking for actions...</span>
            </div>
          ) : actionItems.length === 0 ? (
            <p className="text-sm text-green-700 py-4">All compliance checks are up to date.</p>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => {
                const isHigh = item.priority === 'high';
                const getIcon = () => {
                  switch (item.type) {
                    case 'kyc': return UserCheck;
                    case 'documents': return FolderOpen;
                    case 'sanctions': return Shield;
                    case 'pep': return AlertTriangle;
                    case 'transactions': return Flag;
                    case 'smr': return FileText;
                    case 'edd': return AlertTriangle;
                    default: return Clock;
                  }
                };
                const Icon = getIcon();

                // KYC items get special expandable treatment with inline documents
                if (item.type === 'kyc') {
                  return (
                    <div key={item.id} className="rounded-lg border bg-red-50 border-red-200 overflow-hidden">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center flex-1">
                          <div className="p-2 rounded-lg mr-3 bg-red-100">
                            <Icon className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-900">{item.title}</p>
                            <p className="text-xs text-red-700">
                              {item.description}
                              {kycDocuments.length > 0 && ` • ${kycDocuments.length} document(s) uploaded`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => setShowUploadModal(true)}
                            className="flex items-center px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Upload className="w-3 h-3 mr-1" />
                            Upload
                          </button>
                          {kycDocuments.length > 0 && (
                            <button
                              onClick={() => setExpandedKyc(!expandedKyc)}
                              className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <FolderOpen className="w-3 h-3 mr-1" />
                              View ({kycDocuments.length})
                              {expandedKyc ? (
                                <ChevronDown className="w-3 h-3 ml-1" />
                              ) : (
                                <ChevronRight className="w-3 h-3 ml-1" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleKycReview(item.id, 'approve')}
                            disabled={reviewingKyc}
                            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleKycReview(item.id, 'reject')}
                            disabled={reviewingKyc}
                            className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                      {/* Expandable documents section */}
                      {expandedKyc && kycDocuments.length > 0 && (
                        <div className="border-t border-red-200 bg-white p-3">
                          <p className="text-xs font-medium text-gray-700 mb-2">Uploaded Documents</p>
                          <div className="space-y-2">
                            {kycDocuments.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center">
                                  <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {doc.documentType.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {doc.fileName || 'Document'} •{' '}
                                      <span className={
                                        doc.status === 'approved' ? 'text-green-600' :
                                        doc.status === 'rejected' ? 'text-red-600' :
                                        'text-yellow-600'
                                      }>
                                        {doc.status}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleViewDocument(doc)}
                                    disabled={downloadingDoc === doc.id}
                                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                                    title="View"
                                  >
                                    {downloadingDoc === doc.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDownloadDocument(doc)}
                                    disabled={downloadingDoc === doc.id}
                                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Other action items render normally
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isHigh ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-center flex-1">
                      <div className={`p-2 rounded-lg mr-3 ${isHigh ? 'bg-red-100' : 'bg-yellow-100'}`}>
                        <Icon className={`w-4 h-4 ${isHigh ? 'text-red-600' : 'text-yellow-600'}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isHigh ? 'text-red-900' : 'text-yellow-900'}`}>
                          {item.title}
                        </p>
                        <p className={`text-xs ${isHigh ? 'text-red-700' : 'text-yellow-700'}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {item.type === 'documents' && (
                        <Link
                          href={`/dashboard/documents?customer=${customerId}`}
                          className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Review <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                      {item.type === 'sanctions' && (
                        <Link
                          href="/dashboard/sanctions"
                          className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Review <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                      {item.type === 'pep' && (
                        <Link
                          href="/dashboard/pep"
                          className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Review <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                      {item.type === 'transactions' && (
                        <Link
                          href="/dashboard/transactions"
                          className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Review <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                      {item.type === 'smr' && (
                        <Link
                          href="/dashboard/reports"
                          className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          View Report <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                      {item.type === 'edd' && (
                        <Link
                          href={`/dashboard/edd/${item.id}`}
                          className="flex items-center px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          View Investigation <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Card - Always visible when documents exist */}
      {kycDocuments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-lg">
                <FolderOpen className="w-5 h-5 text-gray-600 mr-2" />
                Documents ({kycDocuments.length})
              </CardTitle>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center px-3 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary/90"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Upload
                </button>
                <button
                  onClick={() => setExpandedDocs(!expandedDocs)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {expandedDocs ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
          {expandedDocs && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {kycDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.documentType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {doc.fileName || 'Document'} •{' '}
                          <span
                            className={
                              doc.status === 'approved'
                                ? 'text-green-600'
                                : doc.status === 'rejected'
                                  ? 'text-red-600'
                                  : 'text-yellow-600'
                            }
                          >
                            {doc.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleViewDocument(doc)}
                        disabled={downloadingDoc === doc.id}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                        title="View"
                      >
                        {downloadingDoc === doc.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDownloadDocument(doc)}
                        disabled={downloadingDoc === doc.id}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upload Document</CardTitle>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
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
                    Document Type
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    {uploadFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-700">{uploadFile.name}</span>
                        <button
                          onClick={() => setUploadFile(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to select file</p>
                        <p className="text-xs text-gray-500 mt-1">
                          JPEG, PNG, WebP, or PDF (max 10MB)
                        </p>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadDocument}
                    disabled={uploading || !uploadFile}
                    className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
