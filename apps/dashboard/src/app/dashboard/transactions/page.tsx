'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Download, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Transaction {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  currency: string;
  direction: 'incoming' | 'outgoing';
  transactionType: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  flaggedForReview: boolean;
  requiresTtr: boolean;
  createdAt: string;
}

// Fallback mock data
const mockTransactions: Transaction[] = [
  {
    id: 'txn_demo_1',
    customerId: 'cus_1',
    customerName: 'John Smith',
    amount: 15000,
    currency: 'AUD',
    direction: 'incoming',
    transactionType: 'deposit',
    riskScore: 25,
    riskLevel: 'low',
    requiresTtr: true,
    flaggedForReview: false,
    createdAt: '2025-12-20T09:00:00Z',
  },
  {
    id: 'txn_demo_2',
    customerId: 'cus_2',
    customerName: 'Acme Corporation',
    amount: 55000,
    currency: 'AUD',
    direction: 'outgoing',
    transactionType: 'wire_transfer',
    riskScore: 65,
    riskLevel: 'medium',
    requiresTtr: true,
    flaggedForReview: true,
    createdAt: '2025-12-21T14:30:00Z',
  },
  {
    id: 'txn_demo_3',
    customerId: 'cus_3',
    customerName: 'Michael Chen',
    amount: 9500,
    currency: 'AUD',
    direction: 'incoming',
    transactionType: 'deposit',
    riskScore: 85,
    riskLevel: 'high',
    requiresTtr: false,
    flaggedForReview: true,
    createdAt: '2025-12-22T11:15:00Z',
  },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFlag, setFilterFlag] = useState<string>('all');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterFlag === 'flagged') params.set('flagged_for_review', 'true');

      const response = await fetch(`/api/proxy/transactions?${params.toString()}`);
      if (!response.ok) throw new Error('API unavailable');

      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setTransactions(data.data);
        setUsingMockData(false);
      } else {
        setTransactions(mockTransactions);
        setUsingMockData(true);
      }
    } catch {
      setTransactions(mockTransactions);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [filterFlag]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      (txn.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFlagged =
      filterFlag === 'all' ||
      (filterFlag === 'flagged' && txn.flaggedForReview) ||
      (filterFlag === 'ttr' && txn.requiresTtr);

    return matchesSearch && matchesFlagged;
  });

  const stats = {
    total: transactions.length,
    totalValue: transactions.reduce((sum, txn) => sum + txn.amount, 0),
    requiresTtr: transactions.filter((t) => t.requiresTtr).length,
    flagged: transactions.filter((t) => t.flaggedForReview).length,
  };

  const getRiskBadge = (level: string) => {
    const badges: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
    };
    return badges[level] || badges.low;
  };

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Customer', 'Amount', 'Currency', 'Direction', 'Type', 'Risk', 'TTR', 'Flagged', 'Date'].join(','),
      ...filteredTransactions.map(t => [
        t.id,
        t.customerName || t.customerId,
        t.amount,
        t.currency,
        t.direction,
        t.transactionType,
        t.riskLevel,
        t.requiresTtr,
        t.flaggedForReview,
        t.createdAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Total Value</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            ${stats.totalValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Requires TTR</p>
          <p className="mt-2 text-3xl font-semibold text-orange-600">{stats.requiresTtr}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-medium text-gray-600">Flagged for Review</p>
          <p className="mt-2 text-3xl font-semibold text-red-600">{stats.flagged}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchTransactions}
                disabled={loading}
                className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usingMockData && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
              Showing demo data. Connect to the API to see real transactions.
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                value={filterFlag}
                onChange={(e) => setFilterFlag(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Transactions</option>
                <option value="flagged">Flagged for Review</option>
                <option value="ttr">Requires TTR</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading transactions...</span>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Direction
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
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{txn.id}</div>
                        <div className="text-sm text-gray-500">{txn.customerName || txn.customerId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {txn.currency} ${txn.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{txn.transactionType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          txn.direction === 'incoming' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {txn.direction}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRiskBadge(txn.riskLevel)}`}>
                          {txn.riskLevel} ({txn.riskScore})
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          {txn.requiresTtr && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              TTR Required
                            </span>
                          )}
                          {txn.flaggedForReview && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Flagged
                            </span>
                          )}
                          {!txn.requiresTtr && !txn.flaggedForReview && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
