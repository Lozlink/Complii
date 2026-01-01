'use client';

import { useState } from 'react';
import { Search, UserCheck, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function KycPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Mock verification requests
  const verifications = [
    {
      id: 'kyc_1',
      customerId: 'cus_1',
      customerName: 'John Smith',
      email: 'john.smith@example.com',
      method: 'document',
      status: 'verified',
      documents: ['passport', 'utility_bill'],
      submittedAt: '2025-12-15T10:30:00Z',
      verifiedAt: '2025-12-15T11:00:00Z',
      riskScore: 15,
    },
    {
      id: 'kyc_2',
      customerId: 'cus_2',
      customerName: 'Sarah Johnson',
      email: 'sarah.j@example.com',
      method: 'document',
      status: 'pending',
      documents: ['drivers_license', 'bank_statement'],
      submittedAt: '2025-12-20T14:30:00Z',
      riskScore: 20,
    },
    {
      id: 'kyc_3',
      customerId: 'cus_3',
      customerName: 'Michael Chen',
      email: 'mchen@example.com',
      method: 'identity_verification',
      status: 'rejected',
      documents: ['passport'],
      submittedAt: '2025-12-18T09:15:00Z',
      rejectedAt: '2025-12-18T10:00:00Z',
      rejectionReason: 'Document quality insufficient',
      riskScore: 75,
    },
  ];

  const filteredVerifications =
    filterStatus === 'all'
      ? verifications
      : verifications.filter((v) => v.status === filterStatus);

  const getStatusBadge = (status: string) => {
    const badges = {
      verified: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      rejected: { class: 'bg-red-100 text-red-800', icon: XCircle },
    };
    return badges[status as keyof typeof badges] || badges.pending;
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
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {verifications.length}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-green-600">
                  {verifications.filter((v) => v.status === 'verified').length}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-yellow-600">
                  {verifications.filter((v) => v.status === 'pending').length}
                </p>
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
                <p className="mt-2 text-3xl font-semibold text-red-600">
                  {verifications.filter((v) => v.status === 'rejected').length}
                </p>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredVerifications.map((verification) => {
              const badge = getStatusBadge(verification.status);
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}
                        >
                          <badge.icon className="w-3 h-3 mr-1" />
                          {verification.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                        <div>
                          <span className="font-medium">Email:</span> {verification.email}
                        </div>
                        <div>
                          <span className="font-medium">Method:</span>{' '}
                          <span className="capitalize">
                            {verification.method.replace('_', ' ')}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Risk Score:</span>{' '}
                          <span
                            className={`font-semibold ${
                              verification.riskScore >= 70
                                ? 'text-red-600'
                                : verification.riskScore >= 40
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                            }`}
                          >
                            {verification.riskScore}/100
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Submitted:</span>{' '}
                          {new Date(verification.submittedAt).toLocaleString()}
                        </div>
                        {verification.verifiedAt && (
                          <div>
                            <span className="font-medium">Verified:</span>{' '}
                            {new Date(verification.verifiedAt).toLocaleString()}
                          </div>
                        )}
                        {verification.rejectedAt && (
                          <div>
                            <span className="font-medium">Rejected:</span>{' '}
                            {new Date(verification.rejectedAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Documents:</span>
                        {verification.documents.map((doc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            {doc.replace('_', ' ')}
                          </span>
                        ))}
                      </div>

                      {verification.rejectionReason && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-red-900">Rejection Reason:</p>
                          <p className="text-sm text-red-800 mt-1">
                            {verification.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>

                    {verification.status === 'pending' && (
                      <div className="flex flex-col space-y-2 ml-4">
                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                          Approve
                        </button>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredVerifications.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No verifications found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
