'use client';

import { useState } from 'react';
import { Search, Download, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Mock data
const mockTransactions = [
  {
    id: 'txn_1',
    customerId: 'cus_1',
    customerName: 'John Smith',
    amount: 15000,
    currency: 'AUD',
    type: 'deposit',
    status: 'completed',
    requiresTTR: true,
    flaggedForReview: false,
    riskScore: 25,
    createdAt: '2025-12-20T09:00:00Z',
  },
  {
    id: 'txn_2',
    customerId: 'cus_2',
    customerName: 'Sarah Johnson',
    amount: 5500,
    currency: 'AUD',
    type: 'withdrawal',
    status: 'pending',
    requiresTTR: false,
    flaggedForReview: false,
    riskScore: 15,
    createdAt: '2025-12-21T14:30:00Z',
  },
  {
    id: 'txn_3',
    customerId: 'cus_3',
    customerName: 'Michael Chen',
    amount: 25000,
    currency: 'AUD',
    type: 'deposit',
    status: 'completed',
    requiresTTR: true,
    flaggedForReview: true,
    riskScore: 85,
    createdAt: '2025-12-22T11:15:00Z',
  },
  {
    id: 'txn_4',
    customerId: 'cus_4',
    customerName: 'Emma Williams',
    amount: 3200,
    currency: 'USD',
    type: 'deposit',
    status: 'completed',
    requiresTTR: false,
    flaggedForReview: false,
    riskScore: 20,
    createdAt: '2025-12-23T16:45:00Z',
  },
];

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFlag, setFilterFlag] = useState<string>('all');

  const filteredTransactions = mockTransactions.filter((txn) => {
    const matchesSearch =
      txn.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || txn.status === filterStatus;
    const matchesFlagged =
      filterFlag === 'all' ||
      (filterFlag === 'flagged' && txn.flaggedForReview) ||
      (filterFlag === 'ttr' && txn.requiresTTR);

    return matchesSearch && matchesStatus && matchesFlagged;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      completed: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      failed: { class: 'bg-red-100 text-red-800', icon: AlertTriangle },
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return 'bg-red-100 text-red-800';
    if (score >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-2 text-gray-600">Monitor transaction activity and compliance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Total Transactions</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {mockTransactions.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Total Value</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            ${mockTransactions.reduce((sum, txn) => sum + txn.amount, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Requires TTR</p>
          <p className="mt-2 text-3xl font-semibold text-orange-600">
            {mockTransactions.filter((t) => t.requiresTTR).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Flagged for Review</p>
          <p className="mt-2 text-3xl font-semibold text-red-600">
            {mockTransactions.filter((t) => t.flaggedForReview).length}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <button className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <select
                value={filterFlag}
                onChange={(e) => setFilterFlag(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Flags</option>
                <option value="flagged">Flagged for Review</option>
                <option value="ttr">Requires TTR</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((txn) => {
                  const statusBadge = getStatusBadge(txn.status);
                  return (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{txn.id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{txn.customerName}</div>
                        <div className="text-sm text-gray-500">{txn.customerId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {txn.currency} ${txn.amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">{txn.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.class}`}
                        >
                          <statusBadge.icon className="w-3 h-3 mr-1" />
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskBadge(txn.riskScore)}`}
                        >
                          {getRiskLevel(txn.riskScore)} ({txn.riskScore})
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          {txn.requiresTTR && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              TTR Required
                            </span>
                          )}
                          {txn.flaggedForReview && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Flagged
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
