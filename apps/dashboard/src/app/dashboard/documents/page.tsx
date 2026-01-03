'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Document {
  id: string;
  customerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  documentNumber?: string;
  issuingCountry?: string;
  issueDate?: string;
  expiryDate?: string;
  rejectionReason?: string;
  uploadedAt: string;
  reviewedAt?: string;
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
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'tax_return', label: 'Tax Return' },
  { value: 'other', label: 'Other' },
];

export default function DocumentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('passport');
  const [uploadDocNumber, setUploadDocNumber] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');

  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  // Fetch customers list
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const response = await fetch('/api/proxy/customers?limit=100');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data.data || []);
    } catch {
      setError('Failed to load customers');
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // Fetch documents for selected customer
  const fetchDocuments = useCallback(async () => {
    if (!selectedCustomerId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/proxy/customers/${selectedCustomerId}/kyc/documents?limit=50`
      );
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data.data || []);
    } catch {
      setError('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async () => {
    if (!uploadFile || !selectedCustomerId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentType', uploadDocType);
      if (uploadDocNumber) formData.append('documentNumber', uploadDocNumber);
      if (uploadExpiryDate) formData.append('expiryDate', uploadExpiryDate);

      const response = await fetch(
        `/api/proxy/customers/${selectedCustomerId}/kyc/documents`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (response.ok) {
        setShowUploadForm(false);
        setUploadFile(null);
        setUploadDocType('passport');
        setUploadDocNumber('');
        setUploadExpiryDate('');
        await fetchDocuments();
        alert('Document uploaded successfully!');
      } else {
        const data = await response.json();
        alert(`Upload failed: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    setDownloadingDoc(doc.id);
    try {
      const response = await fetch(
        `/api/proxy/customers/${selectedCustomerId}/kyc/documents/${doc.id}/download`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('Failed to download document');
      }
    } catch {
      alert('Failed to download document');
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeletingDoc(doc.id);
    try {
      const response = await fetch(
        `/api/proxy/customers/${selectedCustomerId}/kyc/documents/${doc.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchDocuments();
        alert('Document deleted successfully!');
      } else {
        const data = await response.json();
        alert(`Delete failed: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to delete document');
    } finally {
      setDeletingDoc(null);
    }
  };

  const getStatusBadge = (status: string): StatusBadge => {
    const defaultBadge: StatusBadge = { class: 'bg-yellow-100 text-yellow-800', icon: Clock };
    const badges: Record<string, StatusBadge> = {
      approved: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      under_review: { class: 'bg-blue-100 text-blue-800', icon: Clock },
      rejected: { class: 'bg-red-100 text-red-800', icon: XCircle },
    };
    return badges[status] ?? defaultBadge;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stats = {
    total: documents.length,
    approved: documents.filter((d) => d.status === 'approved').length,
    pending: documents.filter((d) => d.status === 'pending' || d.status === 'under_review').length,
    rejected: documents.filter((d) => d.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
          <p className="mt-2 text-gray-600">Upload and manage customer KYC documents</p>
        </div>
        {selectedCustomerId && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload Document
          </button>
        )}
      </div>

      {/* Customer Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
        </CardHeader>
        <CardContent>
          {customersLoading ? (
            <div className="flex items-center">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading customers...
            </div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">-- Select a customer --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.firstName} {customer.lastName} ({customer.email})
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upload Document</CardTitle>
                <button
                  onClick={() => setShowUploadForm(false)}
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
                    File * (JPEG, PNG, WebP, PDF - max 10MB)
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type *
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    Document Number (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadDocNumber}
                    onChange={(e) => setUploadDocNumber(e.target.value)}
                    placeholder="e.g., PA1234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date (optional)
                  </label>
                  <input
                    type="date"
                    value={uploadExpiryDate}
                    onChange={(e) => setUploadExpiryDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowUploadForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || uploading}
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

      {selectedCustomerId && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Documents</p>
                    <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Approved</p>
                    <p className="mt-2 text-3xl font-semibold text-green-600">{stats.approved}</p>
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
                    <p className="text-sm font-medium text-gray-600">Pending</p>
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

          {/* Documents List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <button
                  onClick={fetchDocuments}
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

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-3 text-gray-600">Loading documents...</span>
                </div>
              )}

              {!loading && documents.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No documents found for this customer.</p>
                  <button
                    onClick={() => setShowUploadForm(true)}
                    className="mt-4 text-primary hover:underline"
                  >
                    Upload first document
                  </button>
                </div>
              )}

              {!loading && documents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          File Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Uploaded
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {documents.map((doc) => {
                        const badge = getStatusBadge(doc.status);
                        const BadgeIcon = badge.icon;
                        const canDelete = doc.status === 'pending' || doc.status === 'rejected';

                        return (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <FileText className="w-5 h-5 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-900">
                                  {doc.fileName}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                              {doc.documentType.replace('_', ' ')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {formatFileSize(doc.fileSize)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badge.class}`}
                              >
                                <BadgeIcon className="w-3 h-3 mr-1" />
                                {doc.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleDownload(doc)}
                                  disabled={downloadingDoc === doc.id}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                                  title="Download"
                                >
                                  {downloadingDoc === doc.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={() => handleDelete(doc)}
                                    disabled={deletingDoc === doc.id}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingDoc === doc.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedCustomerId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a customer to view and manage their documents.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
