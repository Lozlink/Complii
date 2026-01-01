'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, FileText, CreditCard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  // Mock data - in real app, fetch from API
  const customer = {
    id: customerId,
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '+61 400 123 456',
    dateOfBirth: '1985-06-15',
    residentialAddress: {
      street: '123 Main Street',
      city: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      country: 'Australia',
    },
    kycStatus: 'verified',
    riskLevel: 'low',
    sanctionsMatch: false,
    isPep: false,
    createdAt: '2025-12-15T10:30:00Z',
    updatedAt: '2025-12-20T14:45:00Z',
    verificationDetails: {
      method: 'document',
      verifiedAt: '2025-12-15T11:00:00Z',
      documents: [
        { id: 'doc_1', type: 'passport', status: 'verified', uploadedAt: '2025-12-15T10:35:00Z' },
        { id: 'doc_2', type: 'utility_bill', status: 'verified', uploadedAt: '2025-12-15T10:36:00Z' },
      ],
    },
    transactions: [
      {
        id: 'txn_1',
        amount: 5000,
        currency: 'AUD',
        type: 'deposit',
        status: 'completed',
        createdAt: '2025-12-16T09:00:00Z',
      },
      {
        id: 'txn_2',
        amount: 2500,
        currency: 'AUD',
        type: 'withdrawal',
        status: 'completed',
        createdAt: '2025-12-18T14:30:00Z',
      },
    ],
    screeningHistory: [
      {
        id: 'scr_1',
        type: 'sanctions',
        result: 'no_match',
        performedAt: '2025-12-15T11:01:00Z',
      },
      {
        id: 'scr_2',
        type: 'pep',
        result: 'no_match',
        performedAt: '2025-12-15T11:02:00Z',
      },
    ],
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      verified: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
      rejected: { class: 'bg-red-100 text-red-800', icon: Shield },
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getRiskBadge = (risk: string) => {
    const badges = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[risk as keyof typeof badges] || badges.low;
  };

  const statusBadge = getStatusBadge(customer.kycStatus);

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
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {customer.firstName} {customer.lastName}
            </h1>
            <p className="mt-2 text-gray-600">{customer.email}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskBadge(customer.riskLevel)}`}
            >
              {customer.riskLevel} risk
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.class}`}
            >
              <statusBadge.icon className="w-4 h-4 mr-1.5" />
              {customer.kycStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {customer.firstName} {customer.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(customer.dateOfBirth).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.phone}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Residential Address</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {customer.residentialAddress.street}, {customer.residentialAddress.city},{' '}
                  {customer.residentialAddress.state} {customer.residentialAddress.postcode},{' '}
                  {customer.residentialAddress.country}
                </dd>
              </div>
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
                {customer.sanctionsMatch ? (
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
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRiskBadge(customer.riskLevel)}`}
                >
                  {customer.riskLevel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KYC Verification */}
        <Card>
          <CardHeader>
            <CardTitle>KYC Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Verification Method</p>
                <p className="mt-1 text-sm text-gray-900 capitalize">
                  {customer.verificationDetails.method}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Verified At</p>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(customer.verificationDetails.verifiedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">Documents</p>
                <div className="space-y-2">
                  {customer.verificationDetails.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-600 mr-2" />
                        <span className="text-sm text-gray-900 capitalize">
                          {doc.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-green-600 font-medium">Verified</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customer.transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <CreditCard className="w-4 h-4 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{txn.type}</p>
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
          </CardContent>
        </Card>
      </div>

      {/* Screening History */}
      <Card>
        <CardHeader>
          <CardTitle>Screening History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Performed At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.screeningHistory.map((screening) => (
                  <tr key={screening.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                      {screening.type}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          screening.result === 'no_match'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {screening.result.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(screening.performedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
